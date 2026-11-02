/**
 * Context-Free Grammar (CFG) Processing Engine
 * Computes FIRST sets, FOLLOW sets, LL(1) Parsing Tables,
 * detects grammar conflicts, and simulates predictive LL(1) parsing.
 */

export const EPSILON = 'ε';
export const EOF_SYMBOL = '$';

export class Production {
    constructor(id, left, right) {
        this.id = id;
        this.left = left;        // Non-terminal string
        this.right = right;      // Array of symbol strings, e.g. ['T', "E'"] or ['ε']
    }

    toString() {
        return `${this.left} -> ${this.right.join(' ')}`;
    }
}

export class Grammar {
    constructor(rawText) {
        this.rawText = rawText;
        this.productions = [];
        this.nonTerminals = new Set();
        this.terminals = new Set();
        this.startSymbol = null;
        this.firstSets = new Map();
        this.followSets = new Map();
        this.parseTable = new Map(); // Map<NonTerminal, Map<Terminal, Production[]>>
        this.conflicts = [];
        this.isLL1 = true;

        if (rawText) {
            this.parse(rawText);
        }
    }

    parse(rawText) {
        this.rawText = rawText;
        this.productions = [];
        this.nonTerminals.clear();
        this.terminals.clear();
        this.startSymbol = null;

        const lines = rawText.split('\n');
        let prodId = 1;

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('//') || line.startsWith('#')) continue;

            const arrowIndex = line.indexOf('->');
            if (arrowIndex === -1) continue;

            const left = line.substring(0, arrowIndex).trim();
            const rightPart = line.substring(arrowIndex + 2).trim();

            if (!this.startSymbol) {
                this.startSymbol = left;
            }
            this.nonTerminals.add(left);

            // Split alternatives separated by '|'
            const alternatives = rightPart.split('|');
            for (let alt of alternatives) {
                alt = alt.trim();
                let symbols;
                if (alt === 'ε' || alt === 'epsilon' || alt === "''" || alt === '""') {
                    symbols = [EPSILON];
                } else {
                    symbols = alt.split(/\s+/).filter(s => s.length > 0);
                    if (symbols.length === 0) {
                        symbols = [EPSILON];
                    }
                }
                this.productions.push(new Production(prodId++, left, symbols));
            }
        }

        // Discover terminals: any symbol in RHS that is not in nonTerminals and not epsilon
        for (const prod of this.productions) {
            for (const sym of prod.right) {
                if (sym !== EPSILON && !this.nonTerminals.has(sym)) {
                    this.terminals.add(sym);
                }
            }
        }

        this.computeFirstSets();
        this.computeFollowSets();
        this.buildParseTable();
    }

    computeFirstSets() {
        this.firstSets.clear();
        for (const nt of this.nonTerminals) {
            this.firstSets.set(nt, new Set());
        }
        for (const t of this.terminals) {
            this.firstSets.set(t, new Set([t]));
        }
        this.firstSets.set(EPSILON, new Set([EPSILON]));

        let changed = true;
        let iterations = 0;
        const MAX_ITER = 100;

        while (changed && iterations++ < MAX_ITER) {
            changed = false;

            for (const prod of this.productions) {
                const targetSet = this.firstSets.get(prod.left);
                const beforeSize = targetSet.size;

                // If right is [EPSILON]
                if (prod.right.length === 1 && prod.right[0] === EPSILON) {
                    targetSet.add(EPSILON);
                    if (targetSet.size > beforeSize) changed = true;
                    continue;
                }

                // Sequence First calculation: X1 X2 ... Xk
                let allDeriveEpsilon = true;
                for (const sym of prod.right) {
                    const symFirst = this.firstSets.get(sym) || new Set([sym]);
                    for (const item of symFirst) {
                        if (item !== EPSILON) {
                            targetSet.add(item);
                        }
                    }

                    if (!symFirst.has(EPSILON)) {
                        allDeriveEpsilon = false;
                        break;
                    }
                }

                if (allDeriveEpsilon) {
                    targetSet.add(EPSILON);
                }

                if (targetSet.size > beforeSize) {
                    changed = true;
                }
            }
        }
    }

    getFirstOfSequence(symbols) {
        const result = new Set();
        if (!symbols || symbols.length === 0) {
            result.add(EPSILON);
            return result;
        }

        let allDeriveEpsilon = true;
        for (const sym of symbols) {
            if (sym === EPSILON) {
                continue;
            }
            const symFirst = this.firstSets.get(sym) || new Set([sym]);
            for (const item of symFirst) {
                if (item !== EPSILON) {
                    result.add(item);
                }
            }

            if (!symFirst.has(EPSILON)) {
                allDeriveEpsilon = false;
                break;
            }
        }

        if (allDeriveEpsilon) {
            result.add(EPSILON);
        }

        return result;
    }

    computeFollowSets() {
        this.followSets.clear();
        for (const nt of this.nonTerminals) {
            this.followSets.set(nt, new Set());
        }

        // Rule 1: Place $ in FOLLOW(StartSymbol)
        if (this.startSymbol && this.followSets.has(this.startSymbol)) {
            this.followSets.get(this.startSymbol).add(EOF_SYMBOL);
        }

        let changed = true;
        let iterations = 0;
        const MAX_ITER = 100;

        while (changed && iterations++ < MAX_ITER) {
            changed = false;

            for (const prod of this.productions) {
                const A = prod.left;

                for (let i = 0; i < prod.right.length; i++) {
                    const B = prod.right[i];

                    if (!this.nonTerminals.has(B)) continue;

                    const followB = this.followSets.get(B);
                    const beforeSize = followB.size;

                    // Beta is the rest of the symbols after B
                    const beta = prod.right.slice(i + 1);

                    if (beta.length > 0) {
                        const firstBeta = this.getFirstOfSequence(beta);
                        for (const sym of firstBeta) {
                            if (sym !== EPSILON) {
                                followB.add(sym);
                            }
                        }

                        // If beta derives epsilon, then FOLLOW(A) is added to FOLLOW(B)
                        if (firstBeta.has(EPSILON)) {
                            const followA = this.followSets.get(A);
                            for (const sym of followA) {
                                followB.add(sym);
                            }
                        }
                    } else {
                        // B is at the very end: A -> alpha B
                        const followA = this.followSets.get(A);
                        for (const sym of followA) {
                            followB.add(sym);
                        }
                    }

                    if (followB.size > beforeSize) {
                        changed = true;
                    }
                }
            }
        }
    }

    buildParseTable() {
        this.parseTable.clear();
        this.conflicts = [];
        this.isLL1 = true;

        const allColumns = Array.from(this.terminals).concat([EOF_SYMBOL]);

        for (const nt of this.nonTerminals) {
            const row = new Map();
            for (const col of allColumns) {
                row.set(col, []);
            }
            this.parseTable.set(nt, row);
        }

        for (const prod of this.productions) {
            const A = prod.left;
            const firstAlpha = this.getFirstOfSequence(prod.right);

            // Rule 1: For each terminal 'a' in FIRST(alpha), add A -> alpha to M[A, a]
            for (const a of firstAlpha) {
                if (a !== EPSILON) {
                    const cell = this.parseTable.get(A).get(a);
                    if (cell) {
                        cell.push(prod);
                        if (cell.length > 1) {
                            this.isLL1 = false;
                            this.conflicts.push({
                                nonTerminal: A,
                                terminal: a,
                                type: 'FIRST/FIRST or MULTI-ENTRY',
                                productions: [...cell]
                            });
                        }
                    }
                }
            }

            // Rule 2: If epsilon is in FIRST(alpha), for each terminal 'b' in FOLLOW(A) (including $), add A -> alpha to M[A, b]
            if (firstAlpha.has(EPSILON)) {
                const followA = this.followSets.get(A) || new Set();
                for (const b of followA) {
                    const cell = this.parseTable.get(A).get(b);
                    if (cell) {
                        // Only add if not already in cell for this production
                        if (!cell.includes(prod)) {
                            cell.push(prod);
                            if (cell.length > 1) {
                                this.isLL1 = false;
                                this.conflicts.push({
                                    nonTerminal: A,
                                    terminal: b,
                                    type: 'FIRST/FOLLOW Conflict',
                                    productions: [...cell]
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    simulateLL1Parse(inputString, maxSteps = 200) {
        // Tokenize input string by whitespace
        const tokens = inputString.trim().split(/\s+/).filter(t => t.length > 0);
        tokens.push(EOF_SYMBOL);

        const steps = [];
        const stack = [EOF_SYMBOL, this.startSymbol];
        let ip = 0; // input pointer
        let stepCount = 0;

        let status = 'IN_PROGRESS';
        let errorMessage = null;

        while (stepCount++ < maxSteps) {
            const top = stack[stack.length - 1];
            const currentInput = tokens[ip];

            const currentStackStr = stack.join(' ');
            const remainingInputStr = tokens.slice(ip).join(' ');

            if (top === EOF_SYMBOL && currentInput === EOF_SYMBOL) {
                steps.push({
                    step: stepCount,
                    stack: currentStackStr,
                    input: remainingInputStr,
                    action: 'ACCEPT',
                    success: true
                });
                status = 'ACCEPTED';
                break;
            }

            if (top === currentInput) {
                // Match terminal
                stack.pop();
                ip++;
                steps.push({
                    step: stepCount,
                    stack: currentStackStr,
                    input: remainingInputStr,
                    action: `Match terminal '${currentInput}'`,
                    matched: currentInput
                });
                continue;
            }

            if (this.terminals.has(top) || top === EOF_SYMBOL) {
                // Terminal on stack doesn't match current input
                status = 'ERROR';
                errorMessage = `Syntax Error: Terminal mismatch. Stack expected '${top}', but found '${currentInput}'.`;
                steps.push({
                    step: stepCount,
                    stack: currentStackStr,
                    input: remainingInputStr,
                    action: `ERROR: Mismatch '${top}' != '${currentInput}'`,
                    error: true
                });
                break;
            }

            // top is a Non-Terminal
            const row = this.parseTable.get(top);
            if (!row) {
                status = 'ERROR';
                errorMessage = `Unknown non-terminal '${top}'`;
                steps.push({
                    step: stepCount,
                    stack: currentStackStr,
                    input: remainingInputStr,
                    action: `ERROR: Unknown non-terminal ${top}`,
                    error: true
                });
                break;
            }

            const cellProds = row.get(currentInput);
            if (!cellProds || cellProds.length === 0) {
                status = 'ERROR';
                errorMessage = `Syntax Error: No parse table entry for M[${top}, ${currentInput}].`;
                steps.push({
                    step: stepCount,
                    stack: currentStackStr,
                    input: remainingInputStr,
                    action: `ERROR: No rule for M[${top}, ${currentInput}]`,
                    error: true
                });
                break;
            }

            const chosenProd = cellProds[0]; // If conflict, pick first
            stack.pop();

            // Push RHS in reverse order, unless it is epsilon
            if (!(chosenProd.right.length === 1 && chosenProd.right[0] === EPSILON)) {
                for (let i = chosenProd.right.length - 1; i >= 0; i--) {
                    stack.push(chosenProd.right[i]);
                }
            }

            steps.push({
                step: stepCount,
                stack: currentStackStr,
                input: remainingInputStr,
                action: `Apply: ${chosenProd.toString()}`,
                production: chosenProd.toString()
            });
        }

        if (stepCount >= maxSteps && status === 'IN_PROGRESS') {
            status = 'ERROR';
            errorMessage = 'Parse limit exceeded. Possible infinite loop or recursion.';
        }

        return {
            status,
            success: status === 'ACCEPTED',
            errorMessage,
            steps
        };
    }
}
