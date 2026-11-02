/**
 * Intermediate Code Generator (ICG)
 * Emits Three-Address Code (TAC), Quadruples, Triples,
 * and partitions TAC into Basic Blocks for Control Flow Graph (CFG) analysis.
 */

import {
    ProgramNode, VarDeclNode, AssignNode, BinaryOpNode,
    UnaryOpNode, LiteralNode, IdentifierNode, BlockNode,
    IfNode, WhileNode, PrintNode, FunctionDeclNode, ReturnNode, CallNode
} from './parser.js';

export class TACInstruction {
    constructor(op, arg1 = '', arg2 = '', result = '', label = null) {
        this.op = op;         // '+', '-', '*', '/', '=', 'if_false', 'goto', 'param', 'call', 'return', 'print', 'label'
        this.arg1 = arg1;
        this.arg2 = arg2;
        this.result = result;
        this.label = label;   // Optional label preceding this instruction
    }

    toString() {
        if (this.op === 'label') {
            return `${this.result}:`;
        }
        if (this.op === '=') {
            return `${this.result} = ${this.arg1}`;
        }
        if (['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', '&&', '||'].includes(this.op)) {
            return `${this.result} = ${this.arg1} ${this.op} ${this.arg2}`;
        }
        if (this.op === 'neg') {
            return `${this.result} = -${this.arg1}`;
        }
        if (this.op === 'not') {
            return `${this.result} = !${this.arg1}`;
        }
        if (this.op === 'if_false') {
            return `if_false ${this.arg1} goto ${this.result}`;
        }
        if (this.op === 'if_true') {
            return `if_true ${this.arg1} goto ${this.result}`;
        }
        if (this.op === 'goto') {
            return `goto ${this.result}`;
        }
        if (this.op === 'param') {
            return `param ${this.arg1}`;
        }
        if (this.op === 'call') {
            return `${this.result ? this.result + ' = ' : ''}call ${this.arg1}, ${this.arg2}`;
        }
        if (this.op === 'return') {
            return `return ${this.arg1}`;
        }
        if (this.op === 'print') {
            return `print ${this.arg1}`;
        }
        return `${this.op} ${this.arg1} ${this.arg2} -> ${this.result}`;
    }
}

export class BasicBlock {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.instructions = [];
        this.predecessors = [];
        this.successors = [];
    }
}

export class IntermediateCodeGenerator {
    constructor() {
        this.instructions = [];
        this.tempCounter = 0;
        this.labelCounter = 0;
    }

    generate(ast, optimize = false) {
        this.instructions = [];
        this.tempCounter = 0;
        this.labelCounter = 0;

        if (ast) {
            this.visit(ast);
        }

        if (optimize) {
            this.optimizeConstantFolding();
        }

        const quadruples = this.getQuadruples();
        const triples = this.getTriples();
        const basicBlocks = this.partitionBasicBlocks();

        return {
            instructions: this.instructions,
            quadruples,
            triples,
            basicBlocks,
            tacString: this.instructions.map(inst => inst.toString()).join('\n')
        };
    }

    newTemp() {
        return `t${this.tempCounter++}`;
    }

    newLabel() {
        return `L${this.labelCounter++}`;
    }

    emit(op, arg1 = '', arg2 = '', result = '') {
        const inst = new TACInstruction(op, String(arg1), String(arg2), String(result));
        this.instructions.push(inst);
        return inst;
    }

    emitLabel(labelName) {
        return this.emit('label', '', '', labelName);
    }

    visit(node) {
        if (!node) return '';

        if (node instanceof ProgramNode) {
            for (const stmt of node.body) {
                this.visit(stmt);
            }
            return '';
        }

        if (node instanceof VarDeclNode) {
            if (node.initializer) {
                const initVal = this.visit(node.initializer);
                this.emit('=', initVal, '', node.name);
            }
            return node.name;
        }

        if (node instanceof AssignNode) {
            const val = this.visit(node.value);
            this.emit('=', val, '', node.name);
            return node.name;
        }

        if (node instanceof LiteralNode) {
            if (node.literalType === 'string') {
                return `"${node.value}"`;
            }
            return String(node.value);
        }

        if (node instanceof IdentifierNode) {
            return node.name;
        }

        if (node instanceof BinaryOpNode) {
            const leftVal = this.visit(node.left);
            const rightVal = this.visit(node.right);
            const temp = this.newTemp();
            this.emit(node.op, leftVal, rightVal, temp);
            return temp;
        }

        if (node instanceof UnaryOpNode) {
            const val = this.visit(node.operand);
            const temp = this.newTemp();
            const opCode = node.op === '-' ? 'neg' : 'not';
            this.emit(opCode, val, '', temp);
            return temp;
        }

        if (node instanceof BlockNode) {
            for (const stmt of node.statements) {
                this.visit(stmt);
            }
            return '';
        }

        if (node instanceof IfNode) {
            const cond = this.visit(node.condition);
            const elseLabel = this.newLabel();
            const endLabel = this.newLabel();

            if (node.elseBranch) {
                this.emit('if_false', cond, '', elseLabel);
                this.visit(node.thenBranch);
                this.emit('goto', '', '', endLabel);
                this.emitLabel(elseLabel);
                this.visit(node.elseBranch);
                this.emitLabel(endLabel);
            } else {
                this.emit('if_false', cond, '', endLabel);
                this.visit(node.thenBranch);
                this.emitLabel(endLabel);
            }
            return '';
        }

        if (node instanceof WhileNode) {
            const startLabel = this.newLabel();
            const endLabel = this.newLabel();

            this.emitLabel(startLabel);
            const cond = this.visit(node.condition);
            this.emit('if_false', cond, '', endLabel);
            this.visit(node.body);
            this.emit('goto', '', '', startLabel);
            this.emitLabel(endLabel);
            return '';
        }

        if (node instanceof PrintNode) {
            const val = this.visit(node.expression);
            this.emit('print', val);
            return '';
        }

        if (node instanceof FunctionDeclNode) {
            const funcEnd = this.newLabel();
            this.emit('goto', '', '', funcEnd); // skip function body in sequential flow
            this.emitLabel(`func_${node.name}`);
            this.emit('func_begin', node.name, String((node.params || []).length));

            // Bind incoming parameters
            if (node.params) {
                for (let i = 0; i < node.params.length; i++) {
                    this.emit('pop_param', '', String(i), node.params[i].name);
                }
            }

            if (node.body) {
                this.visit(node.body);
            }
            this.emit('return', '');
            this.emit('func_end', node.name);
            this.emitLabel(funcEnd);
            return '';
        }

        if (node instanceof ReturnNode) {
            let retVal = '';
            if (node.value) {
                retVal = this.visit(node.value);
            }
            this.emit('return', retVal);
            return '';
        }

        if (node instanceof CallNode) {
            const evaluatedArgs = [];
            for (const arg of node.args) {
                evaluatedArgs.push(this.visit(arg));
            }
            for (const argVal of evaluatedArgs) {
                this.emit('param', argVal);
            }
            const funcName = node.callee.name;
            const temp = this.newTemp();
            this.emit('call', `func_${funcName}`, evaluatedArgs.length, temp);
            return temp;
        }

        return '';
    }

    optimizeConstantFolding() {
        const isNumber = (val) => !isNaN(parseFloat(val)) && isFinite(val) && !val.startsWith('"');

        for (let i = 0; i < this.instructions.length; i++) {
            const inst = this.instructions[i];

            if (['+', '-', '*', '/', '%'].includes(inst.op) && isNumber(inst.arg1) && isNumber(inst.arg2)) {
                const a = parseFloat(inst.arg1);
                const b = parseFloat(inst.arg2);
                let res;
                switch (inst.op) {
                    case '+': res = a + b; break;
                    case '-': res = a - b; break;
                    case '*': res = a * b; break;
                    case '/': res = b !== 0 ? a / b : 0; break;
                    case '%': res = a % b; break;
                }

                // Replace instruction with constant assignment
                inst.op = '=';
                inst.arg1 = String(res);
                inst.arg2 = '';
            }
        }
    }

    getQuadruples() {
        return this.instructions.map((inst, index) => ({
            index,
            op: inst.op,
            arg1: inst.arg1,
            arg2: inst.arg2,
            result: inst.result
        }));
    }

    getTriples() {
        // Map temp variable name to instruction index
        const tempMap = new Map();
        const triples = [];

        this.instructions.forEach((inst, index) => {
            let a1 = inst.arg1;
            let a2 = inst.arg2;

            if (tempMap.has(a1)) a1 = `(${tempMap.get(a1)})`;
            if (tempMap.has(a2)) a2 = `(${tempMap.get(a2)})`;

            if (inst.result && inst.result.startsWith('t')) {
                tempMap.set(inst.result, index);
            }

            triples.push({
                index,
                op: inst.op,
                arg1: a1,
                arg2: a2
            });
        });

        return triples;
    }

    partitionBasicBlocks() {
        if (this.instructions.length === 0) return [];

        const leaders = new Set();
        leaders.add(0); // 1. First instruction is a leader

        for (let i = 0; i < this.instructions.length; i++) {
            const inst = this.instructions[i];

            // 2. Target of any branch is a leader
            if (inst.op === 'goto' || inst.op === 'if_false' || inst.op === 'if_true') {
                const targetLabel = inst.result;
                const targetIndex = this.instructions.findIndex(
                    item => item.op === 'label' && item.result === targetLabel
                );
                if (targetIndex !== -1) {
                    leaders.add(targetIndex);
                }

                // 3. Instruction following a jump is a leader
                if (i + 1 < this.instructions.length) {
                    leaders.add(i + 1);
                }
            }

            // Labels start a block
            if (inst.op === 'label') {
                leaders.add(i);
            }
        }

        const sortedLeaders = Array.from(leaders).sort((a, b) => a - b);
        const blocks = [];

        for (let b = 0; b < sortedLeaders.length; b++) {
            const startIdx = sortedLeaders[b];
            const endIdx = (b + 1 < sortedLeaders.length) ? sortedLeaders[b + 1] : this.instructions.length;

            const block = new BasicBlock(b, `Block B${b}`);
            for (let i = startIdx; i < endIdx; i++) {
                block.instructions.push(this.instructions[i]);
            }
            blocks.push(block);
        }

        // Build edges between blocks
        for (let b = 0; b < blocks.length; b++) {
            const block = blocks[b];
            if (block.instructions.length === 0) continue;

            const lastInst = block.instructions[block.instructions.length - 1];

            if (lastInst.op === 'goto') {
                const targetBlock = blocks.find(blk => blk.instructions.some(i => i.op === 'label' && i.result === lastInst.result));
                if (targetBlock) {
                    block.successors.push(targetBlock.id);
                    targetBlock.predecessors.push(block.id);
                }
            } else if (lastInst.op === 'if_false' || lastInst.op === 'if_true') {
                // Branch target
                const targetBlock = blocks.find(blk => blk.instructions.some(i => i.op === 'label' && i.result === lastInst.result));
                if (targetBlock) {
                    block.successors.push(targetBlock.id);
                    targetBlock.predecessors.push(block.id);
                }
                // Fall-through
                if (b + 1 < blocks.length) {
                    block.successors.push(blocks[b + 1].id);
                    blocks[b + 1].predecessors.push(block.id);
                }
            } else if (lastInst.op !== 'return') {
                // Sequential fall-through
                if (b + 1 < blocks.length) {
                    block.successors.push(blocks[b + 1].id);
                    blocks[b + 1].predecessors.push(block.id);
                }
            }
        }

        return blocks;
    }
}
