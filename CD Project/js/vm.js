/**
 * Virtual Machine (VM) Runtime & Target Execution Simulator
 * Executes Three-Address Code with step-by-step debugging,
 * variable inspection, call stack management, and standard output terminal.
 */

export class VirtualMachine {
    constructor() {
        this.instructions = [];
        this.labels = new Map(); // labelName -> instructionIndex
        this.ip = 0;             // Instruction Pointer
        this.env = new Map();    // Variable / temp storage: name -> value
        this.callStack = [];     // Return addresses
        this.paramStack = [];    // Pending function arguments
        this.output = [];        // Terminal stdout lines
        this.status = 'STOPPED'; // 'STOPPED' | 'RUNNING' | 'PAUSED' | 'HALTED' | 'ERROR'
        this.errorMessage = null;
        this.stepCount = 0;
        this.maxSteps = 20000;
        this.onStepCallback = null;
        this.onFinishCallback = null;
        this.timer = null;
        this.speedMs = 250;
    }

    load(instructions) {
        this.reset();
        this.instructions = instructions || [];
        this.labels.clear();

        // Index all labels
        for (let i = 0; i < this.instructions.length; i++) {
            const inst = this.instructions[i];
            if (inst.op === 'label') {
                this.labels.set(inst.result, i);
            }
        }
    }

    reset() {
        this.stop();
        this.ip = 0;
        this.env.clear();
        this.callStack = [];
        this.paramStack = [];
        this.output = [];
        this.status = 'STOPPED';
        this.errorMessage = null;
        this.stepCount = 0;
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.status === 'RUNNING') {
            this.status = 'PAUSED';
        }
    }

    resolveValue(arg) {
        if (arg === '' || arg === undefined || arg === null) return 0;
        arg = String(arg).trim();

        // Check if string literal
        if (arg.startsWith('"') && arg.endsWith('"')) {
            return arg.substring(1, arg.length - 1);
        }

        // Check if boolean literal
        if (arg === 'true') return true;
        if (arg === 'false') return false;

        // Check if numeric literal
        if (!isNaN(arg) && !isNaN(parseFloat(arg))) {
            return parseFloat(arg);
        }

        // Check environment variable
        if (this.env.has(arg)) {
            return this.env.get(arg);
        }

        return 0; // Uninitialized fallback
    }

    step() {
        if (this.ip >= this.instructions.length) {
            this.status = 'HALTED';
            if (this.onFinishCallback) this.onFinishCallback(this.getState());
            return false;
        }

        if (this.stepCount++ > this.maxSteps) {
            this.status = 'ERROR';
            this.errorMessage = `Execution terminated: Maximum instruction limit (${this.maxSteps}) exceeded. Infinite loop suspected.`;
            if (this.onFinishCallback) this.onFinishCallback(this.getState());
            return false;
        }

        const inst = this.instructions[this.ip];
        const nextIp = this.executeInstruction(inst);
        this.ip = nextIp;

        if (this.onStepCallback) {
            this.onStepCallback(this.getState(), inst);
        }

        if (this.ip >= this.instructions.length && this.status !== 'ERROR') {
            this.status = 'HALTED';
            if (this.onFinishCallback) this.onFinishCallback(this.getState());
            return false;
        }

        return true;
    }

    executeInstruction(inst) {
        let nextIp = this.ip + 1;
        const op = inst.op;

        try {
            switch (op) {
                case 'label':
                    // No-op at runtime
                    break;

                case '=': {
                    const val = this.resolveValue(inst.arg1);
                    this.env.set(inst.result, val);
                    break;
                }

                case '+':
                case '-':
                case '*':
                case '/':
                case '%': {
                    const a = this.resolveValue(inst.arg1);
                    const b = this.resolveValue(inst.arg2);
                    let res;
                    if (op === '+') res = (typeof a === 'string' || typeof b === 'string') ? `${a}${b}` : (a + b);
                    else if (op === '-') res = a - b;
                    else if (op === '*') res = a * b;
                    else if (op === '/') {
                        if (b === 0) throw new Error('Runtime Error: Division by zero');
                        res = Math.floor(a / b) === a / b ? a / b : Number((a / b).toFixed(4));
                    }
                    else if (op === '%') res = a % b;
                    this.env.set(inst.result, res);
                    break;
                }

                case '==':
                case '!=':
                case '<':
                case '<=':
                case '>':
                case '>=': {
                    const a = this.resolveValue(inst.arg1);
                    const b = this.resolveValue(inst.arg2);
                    let boolRes = false;
                    if (op === '==') boolRes = a === b;
                    else if (op === '!=') boolRes = a !== b;
                    else if (op === '<') boolRes = a < b;
                    else if (op === '<=') boolRes = a <= b;
                    else if (op === '>') boolRes = a > b;
                    else if (op === '>=') boolRes = a >= b;
                    this.env.set(inst.result, boolRes);
                    break;
                }

                case '&&': {
                    const a = Boolean(this.resolveValue(inst.arg1));
                    const b = Boolean(this.resolveValue(inst.arg2));
                    this.env.set(inst.result, a && b);
                    break;
                }

                case '||': {
                    const a = Boolean(this.resolveValue(inst.arg1));
                    const b = Boolean(this.resolveValue(inst.arg2));
                    this.env.set(inst.result, a || b);
                    break;
                }

                case 'neg': {
                    const a = this.resolveValue(inst.arg1);
                    this.env.set(inst.result, -a);
                    break;
                }

                case 'not': {
                    const a = Boolean(this.resolveValue(inst.arg1));
                    this.env.set(inst.result, !a);
                    break;
                }

                case 'goto': {
                    const target = this.labels.get(inst.result);
                    if (target !== undefined) {
                        nextIp = target;
                    } else {
                        throw new Error(`Target label '${inst.result}' not found`);
                    }
                    break;
                }

                case 'if_false': {
                    const cond = Boolean(this.resolveValue(inst.arg1));
                    if (!cond) {
                        const target = this.labels.get(inst.result);
                        if (target !== undefined) {
                            nextIp = target;
                        } else {
                            throw new Error(`Target label '${inst.result}' not found`);
                        }
                    }
                    break;
                }

                case 'if_true': {
                    const cond = Boolean(this.resolveValue(inst.arg1));
                    if (cond) {
                        const target = this.labels.get(inst.result);
                        if (target !== undefined) {
                            nextIp = target;
                        } else {
                            throw new Error(`Target label '${inst.result}' not found`);
                        }
                    }
                    break;
                }

                case 'pop_param': {
                    const currentFrame = this.callStack[this.callStack.length - 1];
                    const paramIndex = parseInt(inst.arg2, 10) || 0;
                    const paramVal = (currentFrame && currentFrame.passedArgs && currentFrame.passedArgs[paramIndex] !== undefined)
                        ? currentFrame.passedArgs[paramIndex]
                        : 0;
                    this.env.set(inst.result, paramVal);
                    break;
                }

                case 'func_begin':
                case 'func_end':
                    // Boundary markers, no-op at runtime
                    break;

                case 'param': {
                    const val = this.resolveValue(inst.arg1);
                    this.paramStack.push(val);
                    break;
                }

                case 'call': {
                    const funcTarget = this.labels.get(inst.arg1);
                    if (funcTarget !== undefined) {
                        const argCount = parseInt(inst.arg2, 10) || 0;
                        const passedArgs = this.paramStack.splice(this.paramStack.length - argCount, argCount);
                        this.callStack.push({
                            returnIp: this.ip + 1,
                            resultVar: inst.result,
                            savedEnv: new Map(this.env),
                            passedArgs: passedArgs
                        });
                        nextIp = funcTarget;
                    } else {
                        throw new Error(`Function label '${inst.arg1}' not found`);
                    }
                    break;
                }

                case 'return': {
                    const retVal = inst.arg1 ? this.resolveValue(inst.arg1) : 0;
                    if (this.callStack.length > 0) {
                        const frame = this.callStack.pop();
                        this.env = frame.savedEnv;
                        if (frame.resultVar) {
                            this.env.set(frame.resultVar, retVal);
                        }
                        nextIp = frame.returnIp;
                    } else {
                        // End of program
                        nextIp = this.instructions.length;
                    }
                    break;
                }

                case 'print': {
                    const val = this.resolveValue(inst.arg1);
                    this.output.push(String(val));
                    break;
                }

                default:
                    break;
            }
        } catch (err) {
            this.status = 'ERROR';
            this.errorMessage = err.message;
            nextIp = this.instructions.length;
        }

        return nextIp;
    }

    run(speedMs = null) {
        if (speedMs !== null) this.speedMs = speedMs;
        this.status = 'RUNNING';

        const runLoop = () => {
            if (this.status !== 'RUNNING') return;
            const hasMore = this.step();
            if (hasMore && this.status === 'RUNNING') {
                this.timer = setTimeout(runLoop, this.speedMs);
            }
        };

        runLoop();
    }

    runToCompletion() {
        this.status = 'RUNNING';
        while (this.status === 'RUNNING') {
            const hasMore = this.step();
            if (!hasMore) break;
        }
    }

    getState() {
        const envObj = {};
        for (const [k, v] of this.env.entries()) {
            envObj[k] = v;
        }

        return {
            ip: this.ip,
            status: this.status,
            output: [...this.output],
            env: envObj,
            stepCount: this.stepCount,
            callStackDepth: this.callStack.length,
            errorMessage: this.errorMessage
        };
    }
}
