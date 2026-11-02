/**
 * Automated Syntax and Semantic Processing System - Lexical Analyzer
 * Handles tokenization, regular expression matching, line/column tracking,
 * and lexical error diagnostic generation.
 */

export const TokenType = {
    // Keywords
    KEYWORD_INT: 'KEYWORD_INT',
    KEYWORD_FLOAT: 'KEYWORD_FLOAT',
    KEYWORD_STRING: 'KEYWORD_STRING',
    KEYWORD_BOOL: 'KEYWORD_BOOL',
    KEYWORD_VOID: 'KEYWORD_VOID',
    KEYWORD_IF: 'KEYWORD_IF',
    KEYWORD_ELSE: 'KEYWORD_ELSE',
    KEYWORD_WHILE: 'KEYWORD_WHILE',
    KEYWORD_FOR: 'KEYWORD_FOR',
    KEYWORD_FUNC: 'KEYWORD_FUNC',
    KEYWORD_RETURN: 'KEYWORD_RETURN',
    KEYWORD_PRINT: 'KEYWORD_PRINT',
    KEYWORD_TRUE: 'KEYWORD_TRUE',
    KEYWORD_FALSE: 'KEYWORD_FALSE',

    // Identifiers & Literals
    IDENTIFIER: 'IDENTIFIER',
    LITERAL_INT: 'LITERAL_INT',
    LITERAL_FLOAT: 'LITERAL_FLOAT',
    LITERAL_STRING: 'LITERAL_STRING',
    LITERAL_BOOL: 'LITERAL_BOOL',

    // Operators
    OP_ASSIGN: 'OP_ASSIGN',         // =
    OP_PLUS: 'OP_PLUS',             // +
    OP_MINUS: 'OP_MINUS',           // -
    OP_MUL: 'OP_MUL',               // *
    OP_DIV: 'OP_DIV',               // /
    OP_MOD: 'OP_MOD',               // %
    OP_EQ: 'OP_EQ',                 // ==
    OP_NEQ: 'OP_NEQ',               // !=
    OP_LT: 'OP_LT',                 // <
    OP_LTE: 'OP_LTE',               // <=
    OP_GT: 'OP_GT',                 // >
    OP_GTE: 'OP_GTE',               // >=
    OP_AND: 'OP_AND',               // &&
    OP_OR: 'OP_OR',                 // ||
    OP_NOT: 'OP_NOT',               // !
    ARROW: 'ARROW',                 // ->

    // Delimiters
    LPAREN: 'LPAREN',               // (
    RPAREN: 'RPAREN',               // )
    LBRACE: 'LBRACE',               // {
    RBRACE: 'RBRACE',               // }
    LBRACKET: 'LBRACKET',           // [
    RBRACKET: 'RBRACKET',           // ]
    SEMICOLON: 'SEMICOLON',         // ;
    COMMA: 'COMMA',                 // ,
    COLON: 'COLON',                 // :

    // Special
    EOF: 'EOF',
    ERROR: 'ERROR'
};

const KEYWORDS = {
    'int': TokenType.KEYWORD_INT,
    'float': TokenType.KEYWORD_FLOAT,
    'string': TokenType.KEYWORD_STRING,
    'bool': TokenType.KEYWORD_BOOL,
    'void': TokenType.KEYWORD_VOID,
    'if': TokenType.KEYWORD_IF,
    'else': TokenType.KEYWORD_ELSE,
    'while': TokenType.KEYWORD_WHILE,
    'for': TokenType.KEYWORD_FOR,
    'func': TokenType.KEYWORD_FUNC,
    'return': TokenType.KEYWORD_RETURN,
    'print': TokenType.KEYWORD_PRINT,
    'true': TokenType.KEYWORD_TRUE,
    'false': TokenType.KEYWORD_FALSE
};

export class Token {
    constructor(type, value, line, col, length, pattern = '') {
        this.type = type;
        this.value = value;
        this.line = line;
        this.col = col;
        this.length = length;
        this.pattern = pattern;
    }

    toString() {
        return `<${this.type}, "${this.value}" @ ${this.line}:${this.col}>`;
    }
}

export class LexicalError {
    constructor(message, line, col, length, rawChar) {
        this.message = message;
        this.line = line;
        this.col = col;
        this.length = length || 1;
        this.rawChar = rawChar;
    }
}

export class Lexer {
    constructor(source) {
        this.source = source || '';
        this.pos = 0;
        this.line = 1;
        this.col = 1;
        this.tokens = [];
        this.errors = [];
    }

    tokenize() {
        this.tokens = [];
        this.errors = [];
        this.pos = 0;
        this.line = 1;
        this.col = 1;

        while (this.pos < this.source.length) {
            const ch = this.source[this.pos];

            // 1. Whitespace handling
            if (ch === ' ' || ch === '\t' || ch === '\r') {
                this.advance();
                continue;
            }

            if (ch === '\n') {
                this.advanceLine();
                continue;
            }

            // 2. Comments handling (Single line // and block /* ... */)
            if (ch === '/' && this.peek() === '/') {
                this.skipSingleLineComment();
                continue;
            }

            if (ch === '/' && this.peek() === '*') {
                this.skipMultiLineComment();
                continue;
            }

            // 3. String literals ("...")
            if (ch === '"') {
                this.readString();
                continue;
            }

            // 4. Numbers (Integer or Float)
            if (this.isDigit(ch)) {
                this.readNumber();
                continue;
            }

            // 5. Identifiers or Keywords ([a-zA-Z_][a-zA-Z0-9_]*)
            if (this.isAlpha(ch) || ch === '_') {
                this.readIdentifierOrKeyword();
                continue;
            }

            // 6. Multi-character & Single-character Operators
            if (this.matchOperator()) {
                continue;
            }

            // 7. Delimiters
            if (this.matchDelimiter()) {
                continue;
            }

            // 8. Unrecognized character
            const errLine = this.line;
            const errCol = this.col;
            this.errors.push(new LexicalError(`Unrecognized character '${ch}'`, errLine, errCol, 1, ch));
            this.advance();
        }

        // Add EOF Token
        this.tokens.push(new Token(TokenType.EOF, '$', this.line, this.col, 0, 'EOF'));

        return {
            tokens: this.tokens,
            errors: this.errors
        };
    }

    advance() {
        const ch = this.source[this.pos++];
        this.col++;
        return ch;
    }

    advanceLine() {
        this.pos++;
        this.line++;
        this.col = 1;
    }

    peek(offset = 1) {
        const index = this.pos + offset;
        return index < this.source.length ? this.source[index] : '\0';
    }

    isDigit(c) {
        return c >= '0' && c <= '9';
    }

    isAlpha(c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }

    isAlphaNum(c) {
        return this.isAlpha(c) || this.isDigit(c) || c === '_';
    }

    skipSingleLineComment() {
        // Skip '//'
        this.advance();
        this.advance();
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
            this.advance();
        }
    }

    skipMultiLineComment() {
        const startLine = this.line;
        const startCol = this.col;
        // Skip '/*'
        this.advance();
        this.advance();

        while (this.pos < this.source.length) {
            if (this.source[this.pos] === '*' && this.peek() === '/') {
                this.advance(); // Skip '*'
                this.advance(); // Skip '/'
                return;
            }
            if (this.source[this.pos] === '\n') {
                this.advanceLine();
            } else {
                this.advance();
            }
        }

        this.errors.push(new LexicalError('Unterminated block comment', startLine, startCol, 2, '/*'));
    }

    readString() {
        const startLine = this.line;
        const startCol = this.col;
        this.advance(); // skip opening quote '"'
        let str = '';

        while (this.pos < this.source.length && this.source[this.pos] !== '"') {
            if (this.source[this.pos] === '\n') {
                this.errors.push(new LexicalError('Unterminated string literal (newline before closing quote)', startLine, startCol, str.length + 1, '"'));
                return;
            }

            if (this.source[this.pos] === '\\') {
                this.advance();
                const esc = this.source[this.pos];
                if (esc === 'n') str += '\n';
                else if (esc === 't') str += '\t';
                else if (esc === 'r') str += '\r';
                else if (esc === '"') str += '"';
                else if (esc === '\\') str += '\\';
                else str += esc;
                this.advance();
            } else {
                str += this.source[this.pos];
                this.advance();
            }
        }

        if (this.pos >= this.source.length) {
            this.errors.push(new LexicalError('Unterminated string literal at end of file', startLine, startCol, str.length + 1, '"'));
            return;
        }

        this.advance(); // skip closing quote '"'
        const length = this.col - startCol;
        this.tokens.push(new Token(TokenType.LITERAL_STRING, str, startLine, startCol, length, '"([^"\\\\]|\\\\.)*"'));
    }

    readNumber() {
        const startLine = this.line;
        const startCol = this.col;
        let numStr = '';
        let isFloat = false;

        while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
            numStr += this.source[this.pos];
            this.advance();
        }

        if (this.source[this.pos] === '.' && this.isDigit(this.peek())) {
            isFloat = true;
            numStr += '.';
            this.advance(); // consume '.'

            while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
                numStr += this.source[this.pos];
                this.advance();
            }
        }

        const length = numStr.length;
        if (isFloat) {
            this.tokens.push(new Token(TokenType.LITERAL_FLOAT, parseFloat(numStr), startLine, startCol, length, '[0-9]+\\.[0-9]+'));
        } else {
            this.tokens.push(new Token(TokenType.LITERAL_INT, parseInt(numStr, 10), startLine, startCol, length, '[0-9]+'));
        }
    }

    readIdentifierOrKeyword() {
        const startLine = this.line;
        const startCol = this.col;
        let id = '';

        while (this.pos < this.source.length && this.isAlphaNum(this.source[this.pos])) {
            id += this.source[this.pos];
            this.advance();
        }

        const length = id.length;

        // Check if keyword
        if (KEYWORDS.hasOwnProperty(id)) {
            const tokenType = KEYWORDS[id];
            if (tokenType === TokenType.KEYWORD_TRUE) {
                this.tokens.push(new Token(TokenType.LITERAL_BOOL, true, startLine, startCol, length, 'true'));
            } else if (tokenType === TokenType.KEYWORD_FALSE) {
                this.tokens.push(new Token(TokenType.LITERAL_BOOL, false, startLine, startCol, length, 'false'));
            } else {
                this.tokens.push(new Token(tokenType, id, startLine, startCol, length, id));
            }
        } else {
            this.tokens.push(new Token(TokenType.IDENTIFIER, id, startLine, startCol, length, '[a-zA-Z_][a-zA-Z0-9_]*'));
        }
    }

    matchOperator() {
        const startLine = this.line;
        const startCol = this.col;
        const ch = this.source[this.pos];
        const next = this.peek();

        // 2-character operators
        if (ch === '=' && next === '=') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TokenType.OP_EQ, '==', startLine, startCol, 2, '=='));
            return true;
        }
        if (ch === '!' && next === '=') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TokenType.OP_NEQ, '!=', startLine, startCol, 2, '!='));
            return true;
        }
        if (ch === '<' && next === '=') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TokenType.OP_LTE, '<=', startLine, startCol, 2, '<='));
            return true;
        }
        if (ch === '>' && next === '=') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TokenType.OP_GTE, '>=', startLine, startCol, 2, '>='));
            return true;
        }
        if (ch === '&' && next === '&') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TokenType.OP_AND, '&&', startLine, startCol, 2, '&&'));
            return true;
        }
        if (ch === '|' && next === '|') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TokenType.OP_OR, '||', startLine, startCol, 2, '||'));
            return true;
        }
        if (ch === '-' && next === '>') {
            this.advance(); this.advance();
            this.tokens.push(new Token(TokenType.ARROW, '->', startLine, startCol, 2, '->'));
            return true;
        }

        // 1-character operators
        switch (ch) {
            case '=':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_ASSIGN, '=', startLine, startCol, 1, '='));
                return true;
            case '+':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_PLUS, '+', startLine, startCol, 1, '+'));
                return true;
            case '-':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_MINUS, '-', startLine, startCol, 1, '-'));
                return true;
            case '*':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_MUL, '*', startLine, startCol, 1, '*'));
                return true;
            case '/':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_DIV, '/', startLine, startCol, 1, '/'));
                return true;
            case '%':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_MOD, '%', startLine, startCol, 1, '%'));
                return true;
            case '<':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_LT, '<', startLine, startCol, 1, '<'));
                return true;
            case '>':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_GT, '>', startLine, startCol, 1, '>'));
                return true;
            case '!':
                this.advance();
                this.tokens.push(new Token(TokenType.OP_NOT, '!', startLine, startCol, 1, '!'));
                return true;
        }

        return false;
    }

    matchDelimiter() {
        const startLine = this.line;
        const startCol = this.col;
        const ch = this.source[this.pos];

        switch (ch) {
            case '(':
                this.advance();
                this.tokens.push(new Token(TokenType.LPAREN, '(', startLine, startCol, 1, '\\('));
                return true;
            case ')':
                this.advance();
                this.tokens.push(new Token(TokenType.RPAREN, ')', startLine, startCol, 1, '\\)'));
                return true;
            case '{':
                this.advance();
                this.tokens.push(new Token(TokenType.LBRACE, '{', startLine, startCol, 1, '\\{'));
                return true;
            case '}':
                this.advance();
                this.tokens.push(new Token(TokenType.RBRACE, '}', startLine, startCol, 1, '\\}'));
                return true;
            case '[':
                this.advance();
                this.tokens.push(new Token(TokenType.LBRACKET, '[', startLine, startCol, 1, '\\['));
                return true;
            case ']':
                this.advance();
                this.tokens.push(new Token(TokenType.RBRACKET, ']', startLine, startCol, 1, '\\]'));
                return true;
            case ';':
                this.advance();
                this.tokens.push(new Token(TokenType.SEMICOLON, ';', startLine, startCol, 1, ';'));
                return true;
            case ',':
                this.advance();
                this.tokens.push(new Token(TokenType.COMMA, ',', startLine, startCol, 1, ','));
                return true;
            case ':':
                this.advance();
                this.tokens.push(new Token(TokenType.COLON, ':', startLine, startCol, 1, ':'));
                return true;
        }

        return false;
    }
}
