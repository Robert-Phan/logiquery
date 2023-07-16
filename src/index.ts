export class RuleVariable {
    name: string

    constructor(id: string) {
        this.name = id
    }
}

export let ruleVar = (id: string) => new RuleVariable(id)

type PredicateBase<Args extends any[]> = ((...args: {
    [I in keyof Args]: Args[I] | RuleVariable
}) => Relation)

type Predicate<Args extends any[]> = PredicateBase<Args> & {
    predicateName: string,
    query: QueryPredicate<Args>
    queryUnique: QueryPredicate<Args>
}

type Goal = Relation

export class FactDeclarationError extends Error {
    constructor(message?: string) {
        super(message)
        this.name = "FactDeclarationError"
    }
}

class Relation {
    base: KnowledgeBase
    predicate: Predicate<any>
    args: any[]
    argEqual: (a: any, b: any) => boolean

    constructor(base: KnowledgeBase, predicate: Predicate<any>, args: any[], 
        argEqual: (a: any, b: any) => boolean, name?: string) {
        this.base = base
        this.predicate = predicate
        this.args = args
        this.argEqual = argEqual
        if (name !== undefined)
            this.predicate.predicateName = name
    }

    fact = () => {
        for (let obj of this.args) {
            if (obj instanceof RuleVariable) throw new FactDeclarationError();
        }

        let facts = this.base.facts
        if (facts.has(this.predicate))
            facts.get(this.predicate)?.push(this.args)
        else
            facts.set(this.predicate, [this.args])
    }

    if(firstGoal: Goal, ...extraGoals: Goal[]) {
        let body = [firstGoal, ...extraGoals]

        let headAlreadyExisting = this.addBodyToExistingHead(this, body)
        if (headAlreadyExisting) return;

        this.base.rules.set(this, [body])
    }

    addBodyToExistingHead(ruleHead: Relation, ruleBody: Relation[]) {
        var bodies = this.getBodiesOfRule(ruleHead)
        var ruleExists = bodies !== undefined
        if (ruleExists)
            bodies!.push(ruleBody)
        return ruleExists;
    }

    getBodiesOfRule(head: Relation) {
        for (let [existingHead, bodies] of this.base.rules) {
            if (head.equals(existingHead)) return bodies
        }
    }

    equals(otherRelation: Relation) {
        if (this.predicate !== otherRelation.predicate) return false;

        for (let [i, val] of this.args.entries()) {
            if (this.argEqual(val, otherRelation.args[i]))
                return false;
        }
        return true;
    }
}

const queryVarKind = Symbol()

export class QueryVariable<T> {
    kind = queryVarKind
    values: T[] = []
}

export const queryVar = <T>() => new QueryVariable<T>()

type QueryResultArray<T extends any[]> = Array<T> & {
    success: boolean
}

type QueryPredicateArgs<Args extends any[]> = {
    [I in keyof Args]: Args[I] | QueryVariable<Args[I]>
}

type QueryPredicate<Args extends any[]> = (...args: QueryPredicateArgs<Args>) => QueryResultArray<Args>

export class KnowledgeBase {
    facts = new Map<Predicate<any>, any[][]>()
    rules = new Map<Relation, Relation[][]>()
    equal = (a: any, b: any) => a === b

    constructor(equalityFunction?: (a: any, b: any) => boolean) {
        if (equalityFunction !== undefined)
            this.equal = equalityFunction
    }

    createPredicate<Args extends any[]>(name?: string): Predicate<Args> {
        let predicate = ((...args: any[]) =>
            new Relation(this, predicate, args, this.equal, name)) as Predicate<Args>

        predicate.query = (...args: QueryPredicateArgs<Args>) => this.query(predicate)(...args)
        predicate.queryUnique = (...args: QueryPredicateArgs<Args>) => this.queryUnique(predicate)(...args)
        
        return predicate
    }

    query<Args extends any[]>(predicate: Predicate<Args>): QueryPredicate<Args> {
        let queryPredicate = (...args: any[]) => this.search(predicate, args) as QueryResultArray<Args>
        return queryPredicate
    }

    queryUnique<Args extends any[]>(predicate: Predicate<Args>): QueryPredicate<Args> {
        let queryPredicate = (...args: any[]) => this.search(predicate, args, true) as QueryResultArray<Args>
        return queryPredicate
    }

    private search(predicate: Predicate<any>, searchArgs: any[], unique = false) {
        let argsOfSuccessfulFacts = this.searchInFacts(predicate, searchArgs, unique);
        let argsOfSuccessfulRules = this.searchInRules(predicate, searchArgs, unique);

        let searchResults: any[][] = []
        for (let factArgs of argsOfSuccessfulFacts)
            unique ? this.addUniqueArrayToArrayList(factArgs, searchResults) : searchResults.push(factArgs);
        for (let ruleArgs of argsOfSuccessfulRules)
            unique ? this.addUniqueArrayToArrayList(ruleArgs, searchResults) : searchResults.push(ruleArgs);

        (searchResults as QueryResultArray<any[]>).success = searchResults.length > 0;
        
        return searchResults
    }

    private searchInFacts(predicate: Predicate<any>, searchArgs: any[], unique: boolean) {
        let argsOfRelevantFacts = this.facts.get(predicate)
        if (argsOfRelevantFacts === undefined) return []

        let argsOfSuccessfulFacts: any[][] = []
        for (let factArgs of argsOfRelevantFacts) {
            let queryVarsMapToFactArgs = new Map<QueryVariable<any>, any>()
            let factIsSuccessful = true;

            for (let [i, arg] of factArgs.entries()) {
                if (searchArgs[i] instanceof QueryVariable)
                    queryVarsMapToFactArgs.set(searchArgs[i], arg)
                else if (!this.equal(arg, searchArgs[i])) {
                    factIsSuccessful = false;
                    break;
                }
            }

            if (factIsSuccessful) {
                for (let [queryVar, arg] of queryVarsMapToFactArgs)
                    unique ? this.addUniqueToArray(arg, queryVar.values) : queryVar.values.push(arg)

                argsOfSuccessfulFacts.push(factArgs)
            }
        }

        return argsOfSuccessfulFacts
    }

    private searchInRules(searchPredicate: Predicate<any>, searchArgs: any[], unique: boolean) {
        let argsOfSuccessfulRules: any[][] = []
        for (let [head, bodies] of this.rules) {
            if (head.predicate !== searchPredicate) continue;

            let ruleIsRelevant = true;
            let headRuleVarsMapToSearchArgs = new Map<string, any>()
            let headArgIdxsMapToQueryVars = new Map<number, QueryVariable<any>>()

            for (let [i, headArg] of head.args.entries()) {
                if (searchArgs[i] instanceof QueryVariable)
                    headArgIdxsMapToQueryVars.set(i, searchArgs[i])
                if (headArg instanceof RuleVariable)
                    headRuleVarsMapToSearchArgs.set(headArg.name, searchArgs[i])
                else if (!this.equal(headArg, searchArgs[i])) {
                    ruleIsRelevant = false;
                    break;
                }
            }

            if (!ruleIsRelevant) continue;
            for (let body of bodies) {
                let bodyResultRuleVars = this.processBody(body, headRuleVarsMapToSearchArgs);

                for (let bodyResult of bodyResultRuleVars) {
                    let successfulArgs: any[] = []

                    for (let [idx, headArg] of head.args.entries()) {
                        let succArg: any
                        if (headArg instanceof RuleVariable)
                            succArg = bodyResult.get(headArg.name)
                        else succArg = headArg

                        if (headArgIdxsMapToQueryVars.has(idx)) {
                            let queryVar = headArgIdxsMapToQueryVars.get(idx)
                            if (queryVar === undefined) throw new Error()

                            if (unique)
                                this.addUniqueToArray(succArg, queryVar.values)
                            else
                                queryVar.values.push(succArg)
                        }

                        successfulArgs.push(succArg)
                    }

                    argsOfSuccessfulRules.push(successfulArgs)
                }
            }
        }

        return argsOfSuccessfulRules;
    }

    private processBody(body: Relation[], ruleVarsMapToSearchArgs: Map<string, any>) {
        let bodyResultRuleVarCombinations: [Predicate<any>, Map<string, any>[]][] = [];

        for (let goal of body) {
            let goalArgIndexesMapToRuleVars = new Map<number, string>()
            let goalArgs = goal.args;
            let goalSearchArgs: any[] = []

            for (let [i, gArg] of goalArgs.entries()) {
                if (gArg instanceof RuleVariable) {
                    let gSearchArg = ruleVarsMapToSearchArgs.get(gArg.name);
                    goalSearchArgs.push(
                        (gSearchArg instanceof QueryVariable || gSearchArg === undefined)
                            ? queryVar() : gSearchArg
                    );
                    goalArgIndexesMapToRuleVars.set(i, gArg.name);
                }
                else
                    goalSearchArgs.push(gArg)
            }

            let goalQueryResult = this.search(goal.predicate, goalSearchArgs);
            let ruleVarArgsOfGoalResult: Map<string, any>[] = [];

            for (let goalResultArgs of goalQueryResult) {
                let ruleVarsMapToGoalResultArgs = new Map<string, any>()

                for (let [gArgIdx, gResultArg] of goalResultArgs.entries()) {
                    let ruleVar = goalArgIndexesMapToRuleVars.get(gArgIdx);
                    if (ruleVar === undefined) continue;
                    ruleVarsMapToGoalResultArgs.set(ruleVar, gResultArg)
                }

                ruleVarArgsOfGoalResult.push(ruleVarsMapToGoalResultArgs);
            }

            bodyResultRuleVarCombinations.push([goal.predicate, ruleVarArgsOfGoalResult]);
        }

        return this.narrowRuleSearchResults(bodyResultRuleVarCombinations);
    }

    private narrowRuleSearchResults(bodyResultRuleVarCombinations: [Predicate<any>, Map<string, any>[]][]) {
        let bodyResultRuleVars: Map<string, any>[] = [];

        const inner = (goalIndex: number = 0, possibleResultRuleVars: Map<string, any>) => {
            if (goalIndex >= bodyResultRuleVarCombinations.length) {
                bodyResultRuleVars.push(possibleResultRuleVars);
                return;
            }

            let [_, ruleVarsOfGoals] = bodyResultRuleVarCombinations[goalIndex]
            for (let goalRuleVars of ruleVarsOfGoals) {
                let nextPossibleResultRuleVars = new Map(possibleResultRuleVars);
                let goalRuleVarsIsCompatible = true;

                for (let [goalRuleVar, goalArg] of goalRuleVars) {
                    if (!nextPossibleResultRuleVars.has(goalRuleVar))
                        nextPossibleResultRuleVars.set(goalRuleVar, goalArg);
                    else if (!this.equal(nextPossibleResultRuleVars!.get(goalRuleVar), goalArg)) {
                        goalRuleVarsIsCompatible = false;
                        break;
                    }
                }

                if (goalRuleVarsIsCompatible) inner(goalIndex + 1, nextPossibleResultRuleVars);
            }
        }

        inner(0, new Map());
        return bodyResultRuleVars;
    }

    private addUniqueArrayToArrayList(array: any[], arList: any[][]) {
        for (let listArray of arList) {
            let arrayUnique = false;
    
            for (let [idx, listArrayElem] of listArray.entries()) {
                if (!this.equal(listArrayElem, array[idx])) {
                    arrayUnique = true;
                    break;
                }
            }
    
            if (!arrayUnique) return;
        }
    
        arList.push(array)
    }

    private addUniqueToArray(elem: any, array: any[]) {
        for (let arrayElem of array) {
            if (this.equal(arrayElem, elem)) return;
        }
        array.push(elem)
    }
}
