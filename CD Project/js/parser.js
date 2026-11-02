/**
 * Recursive-Descent Parser & Abstract Syntax Tree (AST) Builder
 * Constructs both Parse Tree (CST) and Abstract Syntax Tree (AST)
 * with robust error recovery and line/column source mapping.
 */

import { TokenType } from './lexer.js';

export class ASTNode {
    constructor(type, line, col) {
        this.type = type;
        this.line = line;
        this.col = col;
        this.inferredType = null; // Populated by Semantic Analyzer
        this.scopeId = null;      // Populated by Semantic Analyzer
    }
}

export class ProgramNode extends ASTNode {
    constructor(body, line = 1, col = 1) {
        super('Program', line, col);
        this.body = body; // Array of statements/declarations
    }
}

export class VarDeclNode extends ASTNode {
    constructor(varType, name, initializer, line, col) {
        super('VarDecl', line, col);
        this.varType = varType; // 'int', 'float', 'string', 'bool'
        this.name = name;
        this.initializer = initializer; // Expression ASTNode or null
    }
}

export class AssignNode extends ASTNode {
    constructor(name, value, line, col) {
        super('Assign', line, col);
        this.name = name;
        this.value = value;
    }
}

export class BinaryOpNode extends ASTNode {
    constructor(left, op, right, line, col) {
        super('BinaryOp', line, col);
        this.left = left;
        this.op = op; // '+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', '&&', '||'
        this.right = right;
    }
}

export class UnaryOpNode extends ASTNode {
    constructor(op, operand, line, col) {
        super('UnaryOp', line, col);
        this.op = op; // '-', '!'
        this.operand = operand;
    }
}

export class LiteralNode extends ASTNode {
    constructor(literalType, value, line, col) {
        super('Literal', line, col);
        this.literalType = literalType; // 'int', 'float', 'string', 'bool'
        this.value = value;
    }
}

export class IdentifierNode extends ASTNode {
    constructor(name, line, col) {
        super('Identifier', line, col);
        this.name = name;
    }
}

export class BlockNode extends ASTNode {
    constructor(statements, line, col) {
        super('Block', line, col);
        this.statements = statements;
    }
}

export class IfNode extends ASTNode {
    constructor(condition, thenBranch, elseBranch, line, col) {
        super('IfStmt', line, col);
        this.condition = condition;
        this.thenBranch = thenBranch;
        this.elseBranch = elseBranch;
    }
}

export class WhileNode extends ASTNode {
    constructor(condition, body, line, col) {
        super('WhileStmt', line, col);
        this.condition = condition;
        this.body = body;
    }
}

export class PrintNode extends ASTNode {
    constructor(expression, line, col) {
        super('PrintStmt', line, col);
        this.expression = expression;
    }
}

export class FunctionDeclNode extends ASTNode {
    constructor(name, params, returnType, body, line, col) {
        super('FunctionDecl', line, col);
        this.name = name;
        this.params = params; // Array of { name, type }
        this.returnType = returnType;
        this.body = body;
    }
}

export class ReturnNode extends ASTNode {
    constructor(value, line, col) {
        super('ReturnStmt', line, col);
        this.value = value;
    }
}

export class CallNode extends ASTNode {
    constructor(callee, args, line, col) {
        super('CallExpr', line, col);
        this.callee = callee;
        this.args = args;
    }
}

export class SyntaxError {
    constructor(message, line, col, token) {
        this.message = message;
        this.line = line;
        this.col = col;
        this.token = token;
    }
}

export class Parser {
    constructor(tokens) {
        this.tokens = tokens || [];
        this.pos = 0;
        this.errors = [];
        this.parseTreeRoot = null;
    }

    parse() {
        this.pos = 0;
        this.errors = [];
        const statements = [];

        while (!this.isAtEnd()) {
            try {
                const stmt = this.declaration();
                if (stmt) {
                    statements.push(stmt);
                }
            } catch (err) {
                // Panic mode synchronization
                this.synchronize();
            }
        }

        const ast = new ProgramNode(statements, 1, 1);
        return {
            ast,
            errors: this.errors
        };
    }

    // Grammar:
    // declaration -> functionDecl | varDecl | statement
    declaration() {
        if (this.match(TokenType.KEYWORD_FUNC)) {
            return this.functionDeclaration();
        }
        if (this.checkTypeKeyword()) {
            return this.varDeclaration();
        }
        return this.statement();
    }

    functionDeclaration() {
        const funcTok = this.previous();
        const nameTok = this.consume(TokenType.IDENTIFIER, "Expected function name after 'func'");
        this.consume(TokenType.LPAREN, "Expected '(' after function name");

        const params = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                if (!this.checkTypeKeyword()) {
                    this.error(this.peek(), "Expected parameter type (int, float, string, bool)");
                    break;
                }
                const pType = this.advance().value;
                const pName = this.consume(TokenType.IDENTIFIER, "Expected parameter identifier").value;
                params.push({ type: pType, name: pName });
            } while (this.match(TokenType.COMMA));
        }

        this.consume(TokenType.RPAREN, "Expected ')' after parameters");

        let returnType = 'void';
        if (this.match(TokenType.ARROW)) {
            if (!this.checkTypeKeyword() && !this.check(TokenType.KEYWORD_VOID)) {
                this.error(this.peek(), "Expected return type after '->'");
            } else {
                returnType = this.advance().value;
            }
        }

        this.consume(TokenType.LBRACE, "Expected '{' before function body");
        const body = this.blockStatement();

        return new FunctionDeclNode(nameTok.value, params, returnType, body, funcTok.line, funcTok.col);
    }

    varDeclaration() {
        const typeTok = this.advance();
        const nameTok = this.consume(TokenType.IDENTIFIER, "Expected variable name after type");
        let initializer = null;

        if (this.match(TokenType.OP_ASSIGN)) {
            initializer = this.expression();
        }

        this.consume(TokenType.SEMICOLON, "Expected ';' after variable declaration");
        return new VarDeclNode(typeTok.value, nameTok.value, initializer, typeTok.line, typeTok.col);
    }

    statement() {
        if (this.match(TokenType.KEYWORD_IF)) {
            return this.ifStatement();
        }
        if (this.match(TokenType.KEYWORD_WHILE)) {
            return this.whileStatement();
        }
        if (this.match(TokenType.KEYWORD_PRINT)) {
            return this.printStatement();
        }
        if (this.match(TokenType.KEYWORD_RETURN)) {
            return this.returnStatement();
        }
        if (this.match(TokenType.LBRACE)) {
            return this.blockStatement();
        }
        return this.expressionStatement();
    }

    ifStatement() {
        const ifTok = this.previous();
        this.consume(TokenType.LPAREN, "Expected '(' after 'if'");
        const condition = this.expression();
        this.consume(TokenType.RPAREN, "Expected ')' after condition");

        const thenBranch = this.statement();
        let elseBranch = null;

        if (this.match(TokenType.KEYWORD_ELSE)) {
            elseBranch = this.statement();
        }

        return new IfNode(condition, thenBranch, elseBranch, ifTok.line, ifTok.col);
    }

    whileStatement() {
        const whileTok = this.previous();
        this.consume(TokenType.LPAREN, "Expected '(' after 'while'");
        const condition = this.expression();
        this.consume(TokenType.RPAREN, "Expected ')' after while condition");

        const body = this.statement();
        return new WhileNode(condition, body, whileTok.line, whileTok.col);
    }

    printStatement() {
        const printTok = this.previous();
        this.consume(TokenType.LPAREN, "Expected '(' after 'print'");
        const expr = this.expression();
        this.consume(TokenType.RPAREN, "Expected ')' after print argument");
        this.consume(TokenType.SEMICOLON, "Expected ';' after print statement");
        return new PrintNode(expr, printTok.line, printTok.col);
    }

    returnStatement() {
        const retTok = this.previous();
        let value = null;
        if (!this.check(TokenType.SEMICOLON)) {
            value = this.expression();
        }
        this.consume(TokenType.SEMICOLON, "Expected ';' after return value");
        return new ReturnNode(value, retTok.line, retTok.col);
    }

    blockStatement() {
        const braceTok = this.previous();
        const statements = [];

        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            statements.push(this.declaration());
        }

        this.consume(TokenType.RBRACE, "Expected '}' after block");
        return new BlockNode(statements, braceTok.line, braceTok.col);
    }

    expressionStatement() {
        const expr = this.expression();
        this.consume(TokenType.SEMICOLON, "Expected ';' after expression");
        return expr;
    }

    expression() {
        return this.assignment();
    }

    assignment() {
        const expr = this.logicalOr();

        if (this.match(TokenType.OP_ASSIGN)) {
            const equals = this.previous();
            const value = this.assignment();

            if (expr instanceof IdentifierNode) {
                return new AssignNode(expr.name, value, expr.line, expr.col);
            }

            this.error(equals, 'Invalid assignment target. Left-hand side must be an identifier.');
        }

        return expr;
    }

    logicalOr() {
        let expr = this.logicalAnd();

        while (this.match(TokenType.OP_OR)) {
            const op = this.previous().value;
            const right = this.logicalAnd();
            expr = new BinaryOpNode(expr, op, right, expr.line, expr.col);
        }

        return expr;
    }

    logicalAnd() {
        let expr = this.equality();

        while (this.match(TokenType.OP_AND)) {
            const op = this.previous().value;
            const right = this.equality();
            expr = new BinaryOpNode(expr, op, right, expr.line, expr.col);
        }

        return expr;
    }

    equality() {
        let expr = this.comparison();

        while (this.match(TokenType.OP_EQ, TokenType.OP_NEQ)) {
            const op = this.previous().value;
            const right = this.comparison();
            expr = new BinaryOpNode(expr, op, right, expr.line, expr.col);
        }

        return expr;
    }

    comparison() {
        let expr = this.term();

        while (this.match(TokenType.OP_LT, TokenType.OP_LTE, TokenType.OP_GT, TokenType.OP_GTE)) {
            const op = this.previous().value;
            const right = this.term();
            expr = new BinaryOpNode(expr, op, right, expr.line, expr.col);
        }

        return expr;
    }

    term() {
        let expr = this.factor();

        while (this.match(TokenType.OP_PLUS, TokenType.OP_MINUS)) {
            const op = this.previous().value;
            const right = this.factor();
            expr = new BinaryOpNode(expr, op, right, expr.line, expr.col);
        }

        return expr;
    }

    factor() {
        let expr = this.unary();

        while (this.match(TokenType.OP_MUL, TokenType.OP_DIV, TokenType.OP_MOD)) {
            const op = this.previous().value;
            const right = this.unary();
            expr = new BinaryOpNode(expr, op, right, expr.line, expr.col);
        }

        return expr;
    }

    unary() {
        if (this.match(TokenType.OP_NOT, TokenType.OP_MINUS)) {
            const op = this.previous().value;
            const right = this.unary();
            return new UnaryOpNode(op, right, this.previous().line, this.previous().col);
        }

        return this.call();
    }

    call() {
        let expr = this.primary();

        while (true) {
            if (this.match(TokenType.LPAREN)) {
                expr = this.finishCall(expr);
            } else {
                break;
            }
        }

        return expr;
    }

    finishCall(callee) {
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                args.push(this.expression());
            } while (this.match(TokenType.COMMA));
        }

        const paren = this.consume(TokenType.RPAREN, "Expected ')' after arguments");
        return new CallNode(callee, args, callee.line, callee.col);
    }

    primary() {
        if (this.match(TokenType.LITERAL_INT)) {
            const prev = this.previous();
            return new LiteralNode('int', prev.value, prev.line, prev.col);
        }
        if (this.match(TokenType.LITERAL_FLOAT)) {
            const prev = this.previous();
            return new LiteralNode('float', prev.value, prev.line, prev.col);
        }
        if (this.match(TokenType.LITERAL_STRING)) {
            const prev = this.previous();
            return new LiteralNode('string', prev.value, prev.line, prev.col);
        }
        if (this.match(TokenType.LITERAL_BOOL)) {
            const prev = this.previous();
            return new LiteralNode('bool', prev.value, prev.line, prev.col);
        }
        if (this.match(TokenType.IDENTIFIER)) {
            const prev = this.previous();
            return new IdentifierNode(prev.value, prev.line, prev.col);
        }

        if (this.match(TokenType.LPAREN)) {
            const expr = this.expression();
            this.consume(TokenType.RPAREN, "Expected ')' after expression");
            return expr;
        }

        throw this.error(this.peek(), `Expected expression, but found '${this.peek().value}' (${this.peek().type})`);
    }

    checkTypeKeyword() {
        return this.check(TokenType.KEYWORD_INT) ||
               this.check(TokenType.KEYWORD_FLOAT) ||
               this.check(TokenType.KEYWORD_STRING) ||
               this.check(TokenType.KEYWORD_BOOL);
    }

    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    check(type) {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    advance() {
        if (!this.isAtEnd()) this.pos++;
        return this.previous();
    }

    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }

    peek() {
        return this.tokens[this.pos];
    }

    previous() {
        return this.tokens[this.pos - 1];
    }

    consume(type, message) {
        if (this.check(type)) return this.advance();
        throw this.error(this.peek(), message);
    }

    error(token, message) {
        const err = new SyntaxError(message, token.line, token.col, token);
        this.errors.push(err);
        return err;
    }

    synchronize() {
        this.advance();

        while (!this.isAtEnd()) {
            if (this.previous().type === TokenType.SEMICOLON) return;

            switch (this.peek().type) {
                case TokenType.KEYWORD_FUNC:
                case TokenType.KEYWORD_INT:
                case TokenType.KEYWORD_FLOAT:
                case TokenType.KEYWORD_STRING:
                case TokenType.KEYWORD_BOOL:
                case TokenType.KEYWORD_IF:
                case TokenType.KEYWORD_WHILE:
                case TokenType.KEYWORD_PRINT:
                case TokenType.KEYWORD_RETURN:
                case TokenType.RBRACE:
                    return;
            }

            this.advance();
        }
    }
}
