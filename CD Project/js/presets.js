/**
 * Pre-loaded Programs and CFG Grammar Presets
 * Showcases various compiler design features including recursion,
 * scope shadowing, type conversions, and intentional semantic error detection.
 */

export const CODE_PRESETS = {
    factorial: {
        name: 'Factorial & Recursion',
        description: 'Demonstrates function declarations, recursive calls, if-branching, and arithmetic.',
        code: `// Automated Syntax & Semantic Processing System
// Demo 1: Factorial via Recursion

func factorial(int n) -> int {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int num = 5;
int result = factorial(num);

print("Computing factorial for:");
print(num);
print("Result is:");
print(result);
`
    },

    control_flow: {
        name: 'While Loops & Logic',
        description: 'Demonstrates while loops, accumulator logic, comparison operators, and boolean tests.',
        code: `// Demo 2: While Loops and Accumulator Sum

int limit = 5;
int counter = 1;
int sum = 0;

print("Starting summation loop up to limit:");
print(limit);

while (counter <= limit) {
    sum = sum + counter;
    print(counter);
    counter = counter + 1;
}

print("Final computed sum:");
print(sum);
`
    },

    types_and_precedence: {
        name: 'Types & Operator Precedence',
        description: 'Demonstrates type checking, operator precedence (* before +), and float promotions.',
        code: `// Demo 3: Expressions, Operator Precedence & Type Widening

int a = 10;
int b = 20;
int c = 3;

// Complex precedence: * and / before + and -
int mathResult = a + b * c - (15 / 3);

float scale = 2.5;
// Implicit widening from int to float
float scaledTotal = mathResult * scale;

string greeting = "Execution complete! Scaled result:";

print(greeting);
print(scaledTotal);
`
    },

    scoping_shadowing: {
        name: 'Lexical Scopes & Shadowing',
        description: 'Demonstrates hierarchical symbol table scopes and variable shadowing in nested blocks.',
        code: `// Demo 4: Hierarchical Scoping & Variable Shadowing

int x = 100;
string label = "Global Scope";

print(label);
print(x);

{
    // Inner block shadows variable 'x'
    int x = 500;
    string label = "Inner Block 1";
    print(label);
    print(x);

    {
        // Deeper nested block
        int x = 999;
        string label = "Deepest Block";
        print(label);
        print(x);
    }

    print("Back to Inner Block 1 x:");
    print(x);
}

print("Back to Global Scope x:");
print(x);
`
    },

    semantic_errors: {
        name: 'Semantic Error Diagnostics',
        description: 'Intentionally triggers semantic errors and warnings (undeclared, type mismatches, duplicate declarations).',
        code: `// Demo 5: Semantic Analyzer Diagnostic Showcase
// This program contains intentional semantic violations to test the analyzer!

int validVar = 42;

// 1. Redeclaration in same scope error
int validVar = 99;

// 2. Type mismatch error: string assigned to int
int number = "Hello Compiler";

// 3. Undeclared identifier error
unregisteredVar = 10;

// 4. Invalid operator types
bool flag = true;
int invalidMath = flag * 5;

// 5. Non-boolean condition error
if (123) {
    print("This condition should be a boolean!");
}

print(validVar);
`
    }
};

export const GRAMMAR_PRESETS = {
    arithmetic_ll1: {
        name: 'Arithmetic Expressions (LL(1) Form)',
        description: 'Standard left-recursion-eliminated arithmetic grammar with + and * precedence.',
        text: `E  -> T E'
E' -> + T E' | ε
T  -> F T'
T' -> * F T' | ε
F  -> ( E ) | id | num`,
        testString: 'id + id * num'
    },

    dangling_else: {
        name: 'If-Else (Dangling Else Ambiguity)',
        description: 'Demonstrates parsing conflict detection (First/Follow or First/First conflict in parse table).',
        text: `S -> if E then S S' | other
S' -> else S | ε
E -> bool`,
        testString: 'if bool then if bool then other else other'
    },

    assignment_stmt: {
        name: 'Statements & Assignments (LL(1) Factored)',
        description: 'Left-factored grammar for sequences of variable assignments and additions.',
        text: `StmtList  -> Stmt StmtList'
StmtList' -> ; Stmt StmtList' | ε
Stmt      -> id = Expr
Expr      -> id Expr'
Expr'     -> + id Expr' | ε`,
        testString: 'id = id + id ; id = id'
    }
};
