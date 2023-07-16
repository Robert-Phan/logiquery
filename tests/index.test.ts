import { KnowledgeBase, queryVar, ruleVar, FactDeclarationError } from "../src/index"

describe("logic query tests", () => {
    let knowledgeBase: KnowledgeBase = new KnowledgeBase()
    type TwoPredicateArg = [string, string]

    const lucy = "Lucy"
    const thomas = "Thomas"
    const lucas = "Lucas"
    const tommy = "Tommy"

    const X = ruleVar("X")
    const Y = ruleVar("Y")
    const Z = ruleVar("Z")

    const parentChild = knowledgeBase.createPredicate<TwoPredicateArg>("parentChild")
    parentChild(lucy, lucas).fact()
    parentChild(thomas, lucas).fact()
    parentChild(lucy, tommy).fact()
    parentChild(thomas, tommy).fact()

    const male = knowledgeBase.createPredicate<[string]>("male")
    const female = knowledgeBase.createPredicate<[string]>("female")
    male(lucas).fact()
    male(thomas).fact()
    female(lucy).fact()
    female(tommy).fact()

    const childParent = knowledgeBase.createPredicate<TwoPredicateArg>("childParent")
    childParent(X, Y).if(
        parentChild(Y, X)
    )

    const mother = knowledgeBase.createPredicate<TwoPredicateArg>("mother")
    mother(X, Y).if(
        parentChild(X, Y),
        female(X)
    )

    const son = knowledgeBase.createPredicate<TwoPredicateArg>("son")
    son(X, Y).if(
        childParent(X, Y),
        male(X)
    )

    const sameGender = knowledgeBase.createPredicate<TwoPredicateArg>("sameGender")
    sameGender(X, Y).if(male(X), male(Y))
    sameGender(X, Y).if(female(X), female(Y))

    const siblingImperfect = knowledgeBase.createPredicate<TwoPredicateArg>("sibling")
    siblingImperfect(X, Y).if(
        parentChild(Z, X),
        parentChild(Z, Y)
    )

    const brotherImperfect = knowledgeBase.createPredicate<TwoPredicateArg>("brother")
    brotherImperfect(X, Y).if(
        parentChild(Z, Y),
        son(X, Z)
    )

    test("throw when adding facts with rule variables in the predicate", () => {
        expect(parentChild(lucy, X).fact).toThrow(FactDeclarationError)
    })

    test("the two query syntax function the same", () => {
        let kbMethod = queryVar<string>()
        let arrayKbMethod = knowledgeBase.query(parentChild)(lucy, kbMethod)

        let predMethod = queryVar<string>()
        let arrayPredMethod = parentChild.query(lucy, predMethod)

        expect(kbMethod).toEqual(predMethod)
        expect(arrayKbMethod).toEqual(arrayPredMethod)
    })

    describe("fact queries", () => {
        test("query variables with fact queries", () => {
            let lucysChildren = queryVar<string>()
            parentChild.query(lucy, lucysChildren)
            expect(lucysChildren.values).toContain(lucas)
            expect(lucysChildren.values).toContain(tommy)

            let tommysParents = queryVar<string>()
            parentChild.query(tommysParents, tommy)
            expect(tommysParents.values).toContain(lucy)
            expect(tommysParents.values).toContain(thomas)
        })

        test("array results with fact queries", () => {
            let lucysChildrenArray = parentChild.query(lucy, queryVar<string>());
            expect(lucysChildrenArray).toContainEqual([lucy, lucas])
            expect(lucysChildrenArray).toContainEqual([lucy, tommy])
            expect(lucysChildrenArray).not.toContainEqual([thomas, lucas])

            let tommysParentsArray = parentChild.query(queryVar<string>(), tommy)
            expect(tommysParentsArray).toContainEqual([lucy, tommy])
            expect(tommysParentsArray).toContainEqual([thomas, tommy])
        })

        test("multi-variable fact queries", () => {
            let parents = queryVar<string>()
            let children = queryVar<string>()
            let parentChildCombinations = parentChild.query(parents, children)

            for (let parent of [lucy, thomas]) {
                expect(parents.values.filter(p => p === parent)).toHaveLength(2)
                for (let child of [lucas, tommy]) {
                    expect(children.values.filter(c => c === child)).toHaveLength(2)
                    expect(parentChildCombinations).toContainEqual([parent, child])
                }
            }
        })

        test("true-or-false fact queries", () => {
            let lucyIsParentOfLucas = parentChild.query(lucy, lucas)
            expect(Array.from(lucyIsParentOfLucas)).toEqual([[lucy, lucas]])
            expect(lucyIsParentOfLucas.success).toBe(true)

            let lucasIsParentOfThomas = parentChild.query(lucas, thomas)
            expect(lucasIsParentOfThomas.success).toBe(false)
        })
    })

    describe("rule-queries", () => {
        test("query variables with rules queries", () => {
            let tommysParents = queryVar<string>()
            childParent.query(tommy, tommysParents)
            expect(tommysParents.values).toContain(lucy)
            expect(tommysParents.values).toContain(thomas)
        })

        test("array results with rule queries", () => {
            let tommysParentsArray = childParent.query(tommy, queryVar<string>())
            expect(tommysParentsArray).toContainEqual([tommy, lucy])
            expect(tommysParentsArray).toContainEqual([tommy, thomas])
            expect(tommysParentsArray).not.toContainEqual([lucas, lucy])
        })

        test("rule queries with multiple goals", () => {
            let tommysMother = queryVar<string>()
            let tommysMotherArray = mother.query(tommysMother, tommy)

            expect(tommysMother.values).toContain(lucy)
            expect(tommysMother.values).not.toContain(thomas)

            expect(tommysMotherArray).toContainEqual([lucy, tommy])
            expect(tommysMotherArray).not.toContainEqual([thomas, tommy])
            expect(tommysMotherArray).not.toContainEqual([lucy, lucas])
        })

        test("rule queries with multiple search levels", () => {
            let lucysSons = queryVar<string>()
            let lucysSonsArray = son.query(lucysSons, lucy)

            expect(lucysSons.values).toEqual([lucas])

            expect(lucysSonsArray).toContainEqual([lucas, lucy])
            expect(lucysSonsArray).toHaveLength(1)
        })

        test("disjunctive rule queries", () => {
            let sameGenderAsLucy = queryVar<string>()
            let sameGenderAsLucyArray = sameGender.query(lucy, sameGenderAsLucy)

            expect(sameGenderAsLucy.values).toContain(lucy)
            expect(sameGenderAsLucy.values).toContain(tommy)
            expect(sameGenderAsLucy.values).toHaveLength(2)

            expect(sameGenderAsLucyArray).toContainEqual([lucy, tommy])
            expect(sameGenderAsLucyArray).toContainEqual([lucy, lucy])

            let sameGenderAsLucas = queryVar<string>()
            let sameGenderAsLucasArray = sameGender.query(sameGenderAsLucas, lucas)

            expect(sameGenderAsLucas.values).toContain(lucas)
            expect(sameGenderAsLucas.values).toContain(thomas)
            expect(sameGenderAsLucas.values).toHaveLength(2)

            expect(sameGenderAsLucasArray).toContainEqual([lucas, lucas])
            expect(sameGenderAsLucasArray).toContainEqual([thomas, lucas])
        })

        test("true-or-false rule queries with multiple search levels", () => {
            let lucasIsSonOfLucy = son.query(lucas, lucy)
            expect(Array.from(lucasIsSonOfLucy)).toEqual([[lucas, lucy]])
            expect(lucasIsSonOfLucy.success).toBe(true)

            let thomasIsSonOfLucy = son.query(thomas, lucy)
            expect(thomasIsSonOfLucy.success).toBe(false)
        })
    })

    describe("complex rule queries", () => {
        test("unique complex rule queries", () => {
            let lucassSiblingsImp = queryVar<string>()
            let lucassSiblingsArrayImp = siblingImperfect.queryUnique(lucas, lucassSiblingsImp)

            for (let siblingName of [lucas, tommy]) {
                let x = lucassSiblingsImp.values.filter(l => l === siblingName)
                expect(x).toHaveLength(1)

                let y = lucassSiblingsArrayImp.filter(a => a[0] === lucas && a[1] === siblingName)
                expect(y).toHaveLength(1)
            }
        })

        test("multi-variable unique complex rule queries", () => {
            let sibling1 = queryVar<string>()
            let sibling2 = queryVar<string>()
            let siblingsCombinationImp = siblingImperfect.queryUnique(sibling1, sibling2)

            for (let siblingName of [lucas, tommy]) {
                for (let siblingQueryVar of [sibling1, sibling2]) {
                    let x = siblingQueryVar.values.filter(s => s === siblingName)
                    expect(x).toHaveLength(1)
                }
            }

            for (let siblingName1 of [lucas, tommy]) {
                for (let siblingName2 of [lucas, tommy]) {
                    let x = siblingsCombinationImp.filter(s => s[0] === siblingName1 && s[1] === siblingName2)
                    expect(x).toHaveLength(1)
                }
            }
        })

        test("unique complex rule queries with multiple search levels", () => {
            let tommysBrothers = queryVar<string>()
            let tommysBrothersArray = brotherImperfect.queryUnique(tommysBrothers, tommy)

            expect(tommysBrothers.values).toEqual([lucas])
            expect(Array.from(tommysBrothersArray)).toEqual([[lucas, tommy]])
        })

        test("multi-variable non-unique complex rule queries", () => {
            let sibling1 = queryVar<string>()
            let sibling2 = queryVar<string>()
            let siblingsCombinationImp = siblingImperfect.query(sibling1, sibling2)

            for (let siblingName of [lucas, tommy]) {
                for (let siblingQueryVar of [sibling1, sibling2]) {
                    let x = siblingQueryVar.values.filter(s => s === siblingName)
                    expect(x).toHaveLength(4)
                }
            }

            for (let siblingName1 of [lucas, tommy]) {
                for (let siblingName2 of [lucas, tommy]) {
                    let x = siblingsCombinationImp.filter(s => s[0] === siblingName1 && s[1] === siblingName2)
                    expect(x).toHaveLength(2)
                }
            }
        })

        test("non-unique complex rule queries with multiple search levels", () => {
            let tommysBrothers = queryVar<string>()
            let tommysBrothersArray = brotherImperfect.query(tommysBrothers, tommy)

            expect(tommysBrothers.values).toEqual([lucas, lucas])
            expect(Array.from(tommysBrothersArray)).toEqual([[lucas, tommy], [lucas, tommy]])
        })

        test("true-or-false complex rule queries with multiple search levels", () => {
            let lucasIsBrotherOfTommy = brotherImperfect.query(lucas, tommy)
            expect(lucasIsBrotherOfTommy.slice()).toEqual([[lucas, tommy], [lucas, tommy]])
            expect(lucasIsBrotherOfTommy.success).toBe(true)

            let thomasIsBrotherOfLucy = brotherImperfect.query(thomas, lucy)
            expect(thomasIsBrotherOfLucy.success).toBe(false)
        })
    })

    describe("custom equality function", () => {
        type Person = {
            name: string,
            age: number
        }

        const equality = (a: Person, b: Person) =>  
            a.age === b.age && a.name === b.name

        let knowledgeBase = new KnowledgeBase(equality)

        const lucas1: Person = {
            name: "Lucas",
            age: 13
        }
        const lucy1: Person = {
            name: "Lucy",
            age: 41
        }
        const lucy2: Person = {
            name: "Lucy",
            age: 23
        }
        const lucas2: Person = {
            name: "Lucas",
            age: 31
        }
        const thomas: Person = {
            name: "Thomas",
            age: 46
        }
        const tommy: Person = {
            name: "Tommy",
            age: 14
        }

        const parentChild = knowledgeBase.createPredicate<[Person, Person]>("parentChildEqual")
        parentChild(lucy1, lucas1).fact()
        parentChild(lucy1, tommy).fact()
        parentChild(thomas, lucas1).fact()
        parentChild(thomas, tommy).fact()

        const male = knowledgeBase.createPredicate<[Person]>()
        const female = knowledgeBase.createPredicate<[Person]>()
        female(lucy1).fact()
        female(lucy2).fact()
        female(tommy).fact()
        male(lucas1).fact()
        male(lucas2).fact()
        male(thomas).fact()

        const mother = knowledgeBase.createPredicate<[Person, Person]>()
        mother(X, Y).if(
            parentChild(X, Y),
            female(X)
        )
        const siblingImperfect = knowledgeBase.createPredicate<[Person, Person]>()
        siblingImperfect(X, Y).if(
            parentChild(Z, X),
            parentChild(Z, Y)
        )

        test("fact queries (different equality function)", () => {
            let lucysChildren = queryVar<Person>()
            let lucysChildrenArray = parentChild.query(lucy1, lucysChildren)

            expect(lucysChildren.values).toContainEqual(lucas1)
            expect(lucysChildren.values).toContainEqual(tommy)
            expect(lucysChildren.values).not.toContainEqual(lucas2)
            expect(lucysChildrenArray).toContainEqual([lucy1, lucas1])
            expect(lucysChildrenArray).not.toContainEqual([lucy1, lucas2])
        })

        test("rule queries with multiple goals (different equality function)", () => {
            let tommysMother = queryVar<Person>()
            let tommysMotherArray = mother.query(tommysMother, tommy)

            expect(tommysMother.values).toContainEqual(lucy1)
            expect(tommysMother.values).not.toContainEqual(lucy2)

            expect(tommysMotherArray).toContainEqual([lucy1, tommy])
            expect(tommysMotherArray).not.toContainEqual([thomas, tommy])
            expect(tommysMotherArray).not.toContainEqual([lucy2, tommy])
        })

        test("multi-variable unique complex rule queries (different equality function)", () => {
            let sibling1 = queryVar<Person>()
            let sibling2 = queryVar<Person>()
            siblingImperfect.queryUnique(sibling1, sibling2)

            for (let siblingQueryVar of [sibling1, sibling2]) {
                for (let siblingName of [lucas1, tommy]) {
                    expect(siblingQueryVar.values).toContainEqual(siblingName)
                }
                expect(siblingQueryVar.values).not.toContainEqual(lucas2)
            }
        })
    })
})