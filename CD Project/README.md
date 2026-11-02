# SYNTAXIA — Automated Syntax & Semantic Processing System

An automated compiler studio, grammar workbench, and execution simulator built for Compiler Design (CD).

🌐 **Local Live Server:** [http://localhost:8080](http://localhost:8080)

---

## 🚀 Key Modules & Capabilities

### 1. Lexical Analysis (Scanner / Lexer)
- **Tokenization:** Splits source code into strongly-typed tokens with line & column tracking.
- **Token Classes:** Keywords (`int`, `float`, `string`, `bool`, `if`, `while`, `func`, `return`, `print`), Identifiers, Literals (Integer, Float, String, Boolean), Operators, and Delimiters.
- **Interactive UI:** Token badge chip stream and a searchable/filterable token table with regular expression patterns matched.

### 2. Syntax Analysis (Parser & AST Visualizer)
- **Recursive-Descent Parser:** Predictive parsing with panic-mode error recovery at semicolons and block boundaries.
- **Interactive SVG Abstract Syntax Tree (AST):**
  - Organic Bézier curve layout.
  - Color-coded node badges (Program, Declarations, Statements, Operators, Literals, Identifiers, Control Flow).
  - Pan (drag) and Zoom (scroll wheel / buttons).
  - Node Inspector panel displaying node type, line/column coordinates, inferred semantic type, and scope ID.

### 3. Context-Free Grammar (CFG) & LL(1) Workbench
- **Automated FIRST & FOLLOW Sets Computation:** Mathematical fix-point iterative calculation for any custom CFG productions.
- **LL(1) Parsing Table Generation ($M[A, a]$):**
  - Conflict detection: Highlights First/First and First/Follow conflicts in red.
  - Automatically identifies if the grammar is LL(1) valid.
- **Interactive Stack Derivation Simulator:** Enter any token sequence (e.g., `id + id * num`) and view the step-by-step parsing stack trace (`Stack`, `Input Buffer`, `Action`).

### 4. Semantic Analysis & Hierarchical Scope Checking
- **Symbol Table:** Tracks variable and function categories, declared types, scope IDs, scope depths, memory offsets, and initialization statuses.
- **Type Checking:** Validates assignment compatibility, arithmetic operand types, boolean conditions, function arity, and return types.
- **Diagnostics Engine:** Detects undeclared identifiers, duplicate declarations in the same scope, type mismatches, and suggests fixes.

### 5. Intermediate Code Generation (ICG)
- **Three-Address Code (TAC):** Linearized instructions with temporary variables (`t0`, `t1`, ...) and jump labels (`L0`, `L1`, ...).
- **Quadruples Table:** `(Op, Arg1, Arg2, Result)`.
- **Triples Table:** Index-referenced representations.
- **Basic Blocks Partitioning:** Identifies leaders and constructs Control Flow Graph (CFG) predecessor/successor edges.
- **Optional Optimization:** Constant folding pass.

### 6. Virtual Machine (VM) Target Execution
- **Stack-based VM Runtime:** Executes Three-Address Code with function call frames, parameter stacks, and saved environment activation records.
- **Step-by-Step Debugger:** Play, pause, step 1 instruction at a time, or run to completion with an adjustable clock speed slider (50ms - 1000ms).
- **Live Variable Watch & Stdout Console:** Real-time updates to memory values and standard terminal output.

---

## 💻 Preloaded Demonstration Programs

1. **Factorial & Recursion:** Function declarations, recursive activation records, if-branching, and arithmetic.
2. **While Loops & Logic:** While loops, accumulator logic, comparison operators, and boolean conditions.
3. **Types & Operator Precedence:** Multi-operator arithmetic precedence (`*` before `+`), float promotions, and string concatenation.
4. **Lexical Scopes & Shadowing:** Nested `{ ... }` blocks with variable shadowing and scope resolution.
5. **Semantic Error Diagnostics:** Intentionally triggers type violations, duplicate identifiers, and undeclared variables to showcase error recovery.

---

## 🛠️ Running Locally

The local server is already running on port 8080:
```bash
python3 -m http.server 8080
```
Open **[http://localhost:8080](http://localhost:8080)** in any modern web browser.
