/**
 * Semantic Analyzer & Symbol Table Processor
 * Constructs hierarchical lexical scopes, checks types, verifies identifiers,
 * generates compiler diagnostics (errors/warnings), and decorates AST nodes.
 */

import {
    ProgramNode, VarDeclNode, AssignNode, BinaryOpNode,
    UnaryOpNode, LiteralNode, IdentifierNode, BlockNode,
    IfNode, WhileNode, PrintNode, FunctionDeclNode, ReturnNode, CallNode
} from './parser.js';

export class SymbolEntry {
    constructor({ name, category, type, scopeId, line, col, offset = 0, isInitialized = false, params = null, returnType = null }) {
        this.name = name;
        this.category = category; // 'variable' | 'parameter' | 'function'
        this.type = type;         // 'int' | 'float' | 'string' | 'bool' | 'void'
        this.scopeId = scopeId;
        this.line = line;
        this.col = col;
        this.offset = offset;
        this.isInitialized = isInitialized;
        this.params = params;     // [{ name, type }] for functions
        this.returnType = returnType;
    }
}

export class Scope {
    constructor(id, name, parent = null, depth = 0) {
        this.id = id;
        this.name = name;
        this.parent = parent;
        this.depth = depth;
        this.symbols = new Map();
        this.children = [];
        this.offsetCounter = 0;
    }

    define(symbol) {
        symbol.offset = this.offsetCounter;
        this.offsetCounter += 4; // Standard 4-byte / pointer slot
        this.symbols.set(symbol.name, symbol);
    }

    lookup(name) {
        if (this.symbols.has(name)) {
            return this.symbols.get(name);
        }
        if (this.parent) {
            return this.parent.lookup(name);
        }
        return null;
    }

    lookupCurrent(name) {
        return this.symbols.get(name) || null;
    }
}

export class Diagnostic {
    constructor(severity, message, line, col, tip = '') {
        this.severity = severity; // 'error' | 'warning' | 'info'
        this.message = message;
        this.line = line;
        this.col = col;
        this.tip = tip;
    }
}

export class SemanticAnalyzer {
    constructor() {
        this.globalScope = null;
        this.currentScope = null;
        this.scopeList = [];
        this.diagnostics = [];
        this.scopeCounter = 0;
        this.currentFunction = null;
    }

    analyze(ast) {
        this.diagnostics = [];
        this.scopeList = [];
        this.scopeCounter = 0;
        this.currentFunction = null;

        this.globalScope = new Scope(this.scopeCounter++, 'Global', null, 0);
        this.scopeList.push(this.globalScope);
        this.currentScope = this.globalScope;

        if (!ast) return { diagnostics: this.diagnostics, scopes: this.scopeList };

        this.visit(ast);

        return {
            diagnostics: this.diagnostics,
            scopes: this.scopeList,
            hasErrors: this.diagnostics.some(d => d.severity === 'error')
        };
    }

    enterScope(name) {
        const newScope = new Scope(this.scopeCounter++, name, this.currentScope, this.currentScope.depth + 1);
        this.currentScope.children.push(newScope);
        this.scopeList.push(newScope);
        this.currentScope = newScope;
        return newScope;
    }

    exitScope() {
        if (this.currentScope.parent) {
            this.currentScope = this.currentScope.parent;
        }
    }

    addError(msg, line, col, tip = '') {
        this.diagnostics.push(new Diagnostic('error', msg, line, col, tip));
    }

    addWarning(msg, line, col, tip = '') {
        this.diagnostics.push(new Diagnostic('warning', msg, line, col, tip));
    }

    visit(node) {
        if (!node) return 'void';
        node.scopeId = this.currentScope.id;

        if (node instanceof ProgramNode) {
            for (const stmt of node.body) {
                this.visit(stmt);
            }
            node.inferredType = 'void';
            return 'void';
        }

        if (node instanceof VarDeclNode) {
            return this.visitVarDecl(node);
        }

        if (node instanceof AssignNode) {
            return this.visitAssign(node);
        }

        if (node instanceof FunctionDeclNode) {
            return this.visitFunctionDecl(node);
        }

        if (node instanceof BlockNode) {
            return this.visitBlock(node);
        }

        if (node instanceof IfNode) {
            return this.visitIf(node);
        }

        if (node instanceof WhileNode) {
            return this.visitWhile(node);
        }

        if (node instanceof PrintNode) {
            return this.visitPrint(node);
        }

        if (node instanceof ReturnNode) {
            return this.visitReturn(node);
        }

        if (node instanceof BinaryOpNode) {
            return this.visitBinaryOp(node);
        }

        if (node instanceof UnaryOpNode) {
            return this.visitUnaryOp(node);
        }

        if (node instanceof CallNode) {
            return this.visitCall(node);
        }

        if (node instanceof IdentifierNode) {
            return this.visitIdentifier(node);
        }

        if (node instanceof LiteralNode) {
            node.inferredType = node.literalType;
            return node.literalType;
        }

        return 'void';
    }

    visitVarDecl(node) {
        const existing = this.currentScope.lookupCurrent(node.name);
        if (existing) {
            this.addError(
                `Redeclaration of identifier '${node.name}' in the same scope (first declared at line ${existing.line})`,
                node.line, node.col,
                `Consider renaming '${node.name}' or reassigning it without redeclaring.`
            );
        }

        let initType = null;
        if (node.initializer) {
            initType = this.visit(node.initializer);
            if (initType && initType !== 'unknown') {
                if (node.varType === initType) {
                    // Perfect match
                } else if (node.varType === 'float' && initType === 'int') {
                    this.addWarning(
                        `Implicit widening conversion from 'int' to 'float' in declaration of '${node.name}'`,
                        node.line, node.col,
                        `Cast is handled automatically by the compiler.`
                    );
                } else {
                    this.addError(
                        `Type mismatch in declaration: cannot initialize variable '${node.name}' of type '${node.varType}' with expression of type '${initType}'`,
                        node.line, node.col,
                        `Ensure the assigned value matches the declared type '${node.varType}'.`
                    );
                }
            }
        }

        const symbol = new SymbolEntry({
            name: node.name,
            category: 'variable',
            type: node.varType,
            scopeId: this.currentScope.id,
            line: node.line,
            col: node.col,
            isInitialized: !!node.initializer
        });

        this.currentScope.define(symbol);
        node.inferredType = node.varType;
        return node.varType;
    }

    visitAssign(node) {
        const symbol = this.currentScope.lookup(node.name);
        const valType = this.visit(node.value);

        if (!symbol) {
            this.addError(
                `Undeclared identifier '${node.name}'. Variables must be declared before assignment.`,
                node.line, node.col,
                `Declare the variable first, e.g. 'int ${node.name} = ...;'`
            );
            node.inferredType = 'unknown';
            return 'unknown';
        }

        symbol.isInitialized = true;

        if (valType && valType !== 'unknown') {
            if (symbol.type === valType) {
                // Compatible
            } else if (symbol.type === 'float' && valType === 'int') {
                this.addWarning(
                    `Implicit numeric widening from 'int' to 'float' in assignment to '${node.name}'`,
                    node.line, node.col
                );
            } else {
                this.addError(
                    `Type mismatch in assignment: cannot assign value of type '${valType}' to variable '${node.name}' of type '${symbol.type}'`,
                    node.line, node.col,
                    `Convert or supply an expression matching '${symbol.type}'.`
                );
            }
        }

        node.inferredType = symbol.type;
        return symbol.type;
    }

    visitFunctionDecl(node) {
        const existing = this.currentScope.lookupCurrent(node.name);
        if (existing) {
            this.addError(
                `Function '${node.name}' is already defined in this scope.`,
                node.line, node.col
            );
        }

        const funcSymbol = new SymbolEntry({
            name: node.name,
            category: 'function',
            type: node.returnType,
            scopeId: this.currentScope.id,
            line: node.line,
            col: node.col,
            params: node.params,
            returnType: node.returnType
        });
        this.currentScope.define(funcSymbol);

        // Enter function body scope
        this.enterScope(`func:${node.name}`);
        const prevFunc = this.currentFunction;
        this.currentFunction = node;

        // Register parameters in the function scope
        for (const p of node.params) {
            const pSym = new SymbolEntry({
                name: p.name,
                category: 'parameter',
                type: p.type,
                scopeId: this.currentScope.id,
                line: node.line,
                col: node.col,
                isInitialized: true
            });
            this.currentScope.define(pSym);
        }

        // Visit body statements
        if (node.body && node.body.statements) {
            for (const s of node.body.statements) {
                this.visit(s);
            }
        }

        this.currentFunction = prevFunc;
        this.exitScope();

        node.inferredType = node.returnType;
        return node.returnType;
    }

    visitBlock(node) {
        this.enterScope(`block_${this.currentScope.id + 1}`);
        for (const s of node.statements) {
            this.visit(s);
        }
        this.exitScope();
        node.inferredType = 'void';
        return 'void';
    }

    visitIf(node) {
        const condType = this.visit(node.condition);
        if (condType !== 'bool' && condType !== 'unknown') {
            this.addError(
                `Condition in 'if' statement must evaluate to 'bool', found '${condType}'`,
                node.condition.line, node.condition.col,
                `Use comparison operators (==, !=, <, >, <=, >=) to produce a boolean.`
            );
        }

        this.visit(node.thenBranch);
        if (node.elseBranch) {
            this.visit(node.elseBranch);
        }

        node.inferredType = 'void';
        return 'void';
    }

    visitWhile(node) {
        const condType = this.visit(node.condition);
        if (condType !== 'bool' && condType !== 'unknown') {
            this.addError(
                `Condition in 'while' loop must evaluate to 'bool', found '${condType}'`,
                node.condition.line, node.condition.col
            );
        }

        this.visit(node.body);
        node.inferredType = 'void';
        return 'void';
    }

    visitPrint(node) {
        const exprType = this.visit(node.expression);
        if (exprType === 'void') {
            this.addError(
                `Cannot print void expression`,
                node.line, node.col
            );
        }
        node.inferredType = 'void';
        return 'void';
    }

    visitReturn(node) {
        if (!this.currentFunction) {
            this.addError(
                `'return' statement outside of function definition`,
                node.line, node.col
            );
            return 'unknown';
        }

        let retType = 'void';
        if (node.value) {
            retType = this.visit(node.value);
        }

        const expectedType = this.currentFunction.returnType;
        if (expectedType !== retType) {
            if (expectedType === 'float' && retType === 'int') {
                this.addWarning(
                    `Returning 'int' where 'float' is expected (implicit widening)`,
                    node.line, node.col
                );
            } else {
                this.addError(
                    `Function '${this.currentFunction.name}' declared to return '${expectedType}', but returned '${retType}'`,
                    node.line, node.col
                );
            }
        }

        node.inferredType = retType;
        return retType;
    }

    visitBinaryOp(node) {
        const leftType = this.visit(node.left);
        const rightType = this.visit(node.right);
        const op = node.op;

        if (leftType === 'unknown' || rightType === 'unknown') {
            node.inferredType = 'unknown';
            return 'unknown';
        }

        // Arithmetic Operators: +, -, *, /, %
        if (['+', '-', '*', '/', '%'].includes(op)) {
            if (op === '+' && (leftType === 'string' || rightType === 'string')) {
                // String concatenation
                node.inferredType = 'string';
                return 'string';
            }

            if (op === '%' && (leftType !== 'int' || rightType !== 'int')) {
                this.addError(
                    `Modulo operator '%' requires integer operands, found '${leftType}' % '${rightType}'`,
                    node.line, node.col
                );
                node.inferredType = 'int';
                return 'int';
            }

            const isNumeric = (t) => t === 'int' || t === 'float';
            if (!isNumeric(leftType) || !isNumeric(rightType)) {
                this.addError(
                    `Operator '${op}' cannot be applied to types '${leftType}' and '${rightType}'`,
                    node.line, node.col,
                    `Both operands must be numeric ('int' or 'float').`
                );
                node.inferredType = 'unknown';
                return 'unknown';
            }

            // Type promotion
            const resultType = (leftType === 'float' || rightType === 'float') ? 'float' : 'int';
            node.inferredType = resultType;
            return resultType;
        }

        // Relational Operators: <, <=, >, >=
        if (['<', '<=', '>', '>='].includes(op)) {
            const isNumeric = (t) => t === 'int' || t === 'float';
            if (!isNumeric(leftType) || !isNumeric(rightType)) {
                this.addError(
                    `Relational operator '${op}' cannot compare '${leftType}' with '${rightType}'`,
                    node.line, node.col
                );
            }
            node.inferredType = 'bool';
            return 'bool';
        }

        // Equality Operators: ==, !=
        if (['==', '!='].includes(op)) {
            if (leftType !== rightType) {
                const numericPair = (leftType === 'int' && rightType === 'float') || (leftType === 'float' && rightType === 'int');
                if (!numericPair) {
                    this.addWarning(
                        `Comparison between distinct types '${leftType}' and '${rightType}' will always yield false/true`,
                        node.line, node.col
                    );
                }
            }
            node.inferredType = 'bool';
            return 'bool';
        }

        // Logical Operators: &&, ||
        if (['&&', '||'].includes(op)) {
            if (leftType !== 'bool' || rightType !== 'bool') {
                this.addError(
                    `Logical operator '${op}' expects boolean operands, found '${leftType}' ${op} '${rightType}'`,
                    node.line, node.col
                );
            }
            node.inferredType = 'bool';
            return 'bool';
        }

        node.inferredType = 'unknown';
        return 'unknown';
    }

    visitUnaryOp(node) {
        const operandType = this.visit(node.operand);
        const op = node.op;

        if (op === '-') {
            if (operandType !== 'int' && operandType !== 'float') {
                this.addError(
                    `Unary minus requires numeric operand, found '${operandType}'`,
                    node.line, node.col
                );
                node.inferredType = 'unknown';
                return 'unknown';
            }
            node.inferredType = operandType;
            return operandType;
        }

        if (op === '!') {
            if (operandType !== 'bool') {
                this.addError(
                    `Logical NOT '!' requires boolean operand, found '${operandType}'`,
                    node.line, node.col
                );
            }
            node.inferredType = 'bool';
            return 'bool';
        }

        node.inferredType = operandType;
        return operandType;
    }

    visitCall(node) {
        if (!(node.callee instanceof IdentifierNode)) {
            this.addError(`Callee must be a function identifier`, node.line, node.col);
            node.inferredType = 'unknown';
            return 'unknown';
        }

        const funcName = node.callee.name;
        const symbol = this.currentScope.lookup(funcName);

        if (!symbol) {
            this.addError(
                `Call to undeclared function '${funcName}'`,
                node.line, node.col,
                `Define the function using 'func ${funcName}(...) -> ... { ... }' before calling.`
            );
            node.inferredType = 'unknown';
            return 'unknown';
        }

        if (symbol.category !== 'function') {
            this.addError(
                `'${funcName}' is a ${symbol.category}, not a callable function`,
                node.line, node.col
            );
            node.inferredType = 'unknown';
            return 'unknown';
        }

        const expectedParams = symbol.params || [];
        if (node.args.length !== expectedParams.length) {
            this.addError(
                `Function '${funcName}' expects ${expectedParams.length} argument(s), but received ${node.args.length}`,
                node.line, node.col
            );
        }

        for (let i = 0; i < Math.min(node.args.length, expectedParams.length); i++) {
            const argType = this.visit(node.args[i]);
            const paramType = expectedParams[i].type;

            if (argType !== paramType && !(paramType === 'float' && argType === 'int')) {
                this.addError(
                    `Argument ${i + 1} of '${funcName}' has type '${argType}', expected '${paramType}'`,
                    node.args[i].line, node.args[i].col
                );
            }
        }

        node.inferredType = symbol.returnType;
        return symbol.returnType;
    }

    visitIdentifier(node) {
        const symbol = this.currentScope.lookup(node.name);
        if (!symbol) {
            this.addError(
                `Undeclared identifier '${node.name}'`,
                node.line, node.col,
                `Declare '${node.name}' with a type before referencing it.`
            );
            node.inferredType = 'unknown';
            return 'unknown';
        }

        if (!symbol.isInitialized && symbol.category === 'variable') {
            this.addWarning(
                `Variable '${node.name}' may be used before being initialized`,
                node.line, node.col
            );
        }

        node.inferredType = symbol.type;
        return symbol.type;
    }
}
