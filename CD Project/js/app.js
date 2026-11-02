/**
 * Main Application Orchestrator
 * Connects Lexer, Parser, Semantic Analyzer, ICG, VM, Grammar Engine, and UI.
 */

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { SemanticAnalyzer } from './semantics.js';
import { IntermediateCodeGenerator } from './intermediate.js';
import { VirtualMachine } from './vm.js';
import { ASTVisualizer } from './visualizer.js';
import { Grammar, EPSILON, EOF_SYMBOL } from './grammar.js';
import { CODE_PRESETS, GRAMMAR_PRESETS } from './presets.js';

class CompilerApp {
    constructor() {
        this.lexer = null;
        this.parser = null;
        this.semanticAnalyzer = new SemanticAnalyzer();
        this.icg = new IntermediateCodeGenerator();
        this.vm = new VirtualMachine();
        this.astVisualizer = null;
        this.currentGrammar = null;

        this.currentCompilation = null;

        this.initDOMElements();
        this.initVisualizers();
        this.bindEvents();
        this.loadInitialPresets();
        this.runFullPipeline();
    }

    initDOMElements() {
        // Main tabs
        this.tabButtons = document.querySelectorAll('.main-nav-btn');
        this.viewContainers = document.querySelectorAll('.view-section');

        // Sub tabs in pipeline view
        this.pipelineTabs = document.querySelectorAll('.pipeline-tab-btn');
        this.pipelinePanels = document.querySelectorAll('.pipeline-panel');

        // Source code editor
        this.sourceCodeEditor = document.getElementById('source-code-editor');
        this.lineNumbers = document.getElementById('editor-line-numbers');
        this.codePresetSelect = document.getElementById('code-preset-select');
        this.btnCompile = document.getElementById('btn-compile');
        this.btnStepPipeline = document.getElementById('btn-step-pipeline');
        this.statusBadge = document.getElementById('pipeline-status-badge');
        this.editorStats = document.getElementById('editor-stats');

        // Output views
        this.tokenCardsContainer = document.getElementById('token-cards-container');
        this.tokenTableBody = document.getElementById('token-table-body');
        this.tokenSearchInput = document.getElementById('token-search-input');
        this.tokenCountBadge = document.getElementById('token-count-badge');

        // AST view
        this.astSvg = document.getElementById('ast-svg');
        this.nodeInfoPanel = document.getElementById('node-info-panel');
        this.btnZoomIn = document.getElementById('btn-zoom-in');
        this.btnZoomOut = document.getElementById('btn-zoom-out');
        this.btnResetView = document.getElementById('btn-reset-view');

        // Semantics view
        this.symbolTableBody = document.getElementById('symbol-table-body');
        this.scopeHierarchyTree = document.getElementById('scope-hierarchy-tree');
        this.diagnosticsList = document.getElementById('diagnostics-list');
        this.diagnosticsCountBadge = document.getElementById('diagnostics-count-badge');

        // ICG view
        this.tacOutput = document.getElementById('tac-output');
        this.quadruplesTableBody = document.getElementById('quadruples-table-body');
        this.triplesTableBody = document.getElementById('triples-table-body');
        this.basicBlocksContainer = document.getElementById('basic-blocks-container');
        this.chkOptimize = document.getElementById('chk-optimize-tac');

        // VM / Runtime view
        this.vmStdout = document.getElementById('vm-stdout');
        this.vmEnvTableBody = document.getElementById('vm-env-table-body');
        this.vmStatusBadge = document.getElementById('vm-status-badge');
        this.btnVmRun = document.getElementById('btn-vm-run');
        this.btnVmStep = document.getElementById('btn-vm-step');
        this.btnVmPause = document.getElementById('btn-vm-pause');
        this.btnVmReset = document.getElementById('btn-vm-reset');
        this.vmSpeedSlider = document.getElementById('vm-speed-slider');
        this.vmSpeedVal = document.getElementById('vm-speed-val');
        this.btnClearStdout = document.getElementById('btn-clear-stdout');

        // CFG Grammar workbench
        this.grammarEditor = document.getElementById('grammar-editor');
        this.grammarPresetSelect = document.getElementById('grammar-preset-select');
        this.btnAnalyzeGrammar = document.getElementById('btn-analyze-grammar');
        this.firstFollowTableBody = document.getElementById('first-follow-table-body');
        this.parseTableContainer = document.getElementById('parse-table-container');
        this.grammarStatusBadge = document.getElementById('grammar-status-badge');
        this.grammarConflictsAlert = document.getElementById('grammar-conflicts-alert');
        this.inputDerivationString = document.getElementById('input-derivation-string');
        this.btnSimulateParse = document.getElementById('btn-simulate-parse');
        this.parseSimulationTableBody = document.getElementById('parse-simulation-table-body');
        this.parseSimulationResult = document.getElementById('parse-simulation-result');

        // Modal & Export
        this.btnExportReport = document.getElementById('btn-export-report');
        this.btnShowTheory = document.getElementById('btn-show-theory');
        this.theoryModal = document.getElementById('theory-modal');
        this.btnCloseModal = document.getElementById('btn-close-modal');
    }

    initVisualizers() {
        if (this.astSvg) {
            this.astVisualizer = new ASTVisualizer(this.astSvg, this.nodeInfoPanel);
        }

        // Configure VM callbacks
        this.vm.onStepCallback = (state, inst) => {
            this.updateVMUI(state, inst);
        };
        this.vm.onFinishCallback = (state) => {
            this.updateVMUI(state);
        };
    }

    bindEvents() {
        // Main view switching
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetView = btn.dataset.view;
                this.switchMainView(targetView);
            });
        });

        // Pipeline sub-tab switching
        this.pipelineTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPanel = btn.dataset.panel;
                this.switchPipelinePanel(targetPanel);
            });
        });

        // Editor input & line numbers sync
        this.sourceCodeEditor.addEventListener('input', () => {
            this.updateLineNumbers();
            this.updateEditorStats();
        });
        this.sourceCodeEditor.addEventListener('scroll', () => {
            this.lineNumbers.scrollTop = this.sourceCodeEditor.scrollTop;
        });

        // Code preset selector
        this.codePresetSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (CODE_PRESETS[key]) {
                this.sourceCodeEditor.value = CODE_PRESETS[key].code;
                this.updateLineNumbers();
                this.updateEditorStats();
                this.runFullPipeline();
            }
        });

        // Compile button
        this.btnCompile.addEventListener('click', () => {
            this.runFullPipeline();
        });

        // ICG optimization checkbox
        if (this.chkOptimize) {
            this.chkOptimize.addEventListener('change', () => {
                this.runFullPipeline();
            });
        }

        // Token filter search
        if (this.tokenSearchInput) {
            this.tokenSearchInput.addEventListener('input', (e) => {
                this.filterTokenTable(e.target.value);
            });
        }

        // AST Zoom controls
        if (this.btnZoomIn) this.btnZoomIn.addEventListener('click', () => this.astVisualizer.zoomIn());
        if (this.btnZoomOut) this.btnZoomOut.addEventListener('click', () => this.astVisualizer.zoomOut());
        if (this.btnResetView) this.btnResetView.addEventListener('click', () => this.astVisualizer.resetView());

        // VM Execution controls
        if (this.btnVmRun) {
            this.btnVmRun.addEventListener('click', () => {
                const speed = parseInt(this.vmSpeedSlider.value, 10);
                this.vm.run(speed);
                this.vmStatusBadge.textContent = 'RUNNING';
                this.vmStatusBadge.className = 'status-pill running';
            });
        }
        if (this.btnVmStep) {
            this.btnVmStep.addEventListener('click', () => {
                this.vm.stop();
                this.vm.step();
            });
        }
        if (this.btnVmPause) {
            this.btnVmPause.addEventListener('click', () => {
                this.vm.stop();
                this.vmStatusBadge.textContent = 'PAUSED';
                this.vmStatusBadge.className = 'status-pill paused';
            });
        }
        if (this.btnVmReset) {
            this.btnVmReset.addEventListener('click', () => {
                if (this.currentCompilation && this.currentCompilation.tac) {
                    this.vm.load(this.currentCompilation.tac.instructions);
                    this.updateVMUI(this.vm.getState());
                }
            });
        }
        if (this.vmSpeedSlider) {
            this.vmSpeedSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                this.vmSpeedVal.textContent = `${val}ms`;
                this.vm.speedMs = parseInt(val, 10);
            });
        }
        if (this.btnClearStdout) {
            this.btnClearStdout.addEventListener('click', () => {
                this.vmStdout.innerHTML = '';
            });
        }

        // CFG Grammar workbench events
        this.grammarPresetSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (GRAMMAR_PRESETS[key]) {
                this.grammarEditor.value = GRAMMAR_PRESETS[key].text;
                this.inputDerivationString.value = GRAMMAR_PRESETS[key].testString || '';
                this.analyzeGrammar();
            }
        });

        this.btnAnalyzeGrammar.addEventListener('click', () => {
            this.analyzeGrammar();
        });

        this.btnSimulateParse.addEventListener('click', () => {
            this.simulateDerivation();
        });

        // Theory modal
        if (this.btnShowTheory) {
            this.btnShowTheory.addEventListener('click', () => {
                this.theoryModal.classList.add('active');
            });
        }
        if (this.btnCloseModal) {
            this.btnCloseModal.addEventListener('click', () => {
                this.theoryModal.classList.remove('active');
            });
        }
        if (this.theoryModal) {
            this.theoryModal.addEventListener('click', (e) => {
                if (e.target === this.theoryModal) {
                    this.theoryModal.classList.remove('active');
                }
            });
        }

        // Export report
        if (this.btnExportReport) {
            this.btnExportReport.addEventListener('click', () => {
                this.exportAnalysisReport();
            });
        }
    }

    loadInitialPresets() {
        // Load initial code preset
        if (CODE_PRESETS.factorial) {
            this.sourceCodeEditor.value = CODE_PRESETS.factorial.code;
            this.updateLineNumbers();
            this.updateEditorStats();
        }

        // Load initial grammar preset
        if (GRAMMAR_PRESETS.arithmetic_ll1) {
            this.grammarEditor.value = GRAMMAR_PRESETS.arithmetic_ll1.text;
            this.inputDerivationString.value = GRAMMAR_PRESETS.arithmetic_ll1.testString;
            this.analyzeGrammar();
        }
    }

    switchMainView(targetView) {
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === targetView);
        });
        this.viewContainers.forEach(container => {
            container.classList.toggle('active', container.id === `view-${targetView}`);
        });

        if (targetView === 'compiler' && this.astVisualizer && this.currentCompilation && this.currentCompilation.ast) {
            setTimeout(() => this.astVisualizer.resetView(), 50);
        }
    }

    switchPipelinePanel(targetPanel) {
        this.pipelineTabs.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === targetPanel);
        });
        this.pipelinePanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${targetPanel}`);
        });

        if (targetPanel === 'ast' && this.astVisualizer && this.currentCompilation && this.currentCompilation.ast) {
            setTimeout(() => this.astVisualizer.resetView(), 50);
        }
    }

    updateLineNumbers() {
        const lines = this.sourceCodeEditor.value.split('\n').length;
        let lineHtml = '';
        for (let i = 1; i <= lines; i++) {
            lineHtml += `<div>${i}</div>`;
        }
        this.lineNumbers.innerHTML = lineHtml;
    }

    updateEditorStats() {
        const text = this.sourceCodeEditor.value;
        const lines = text.split('\n').length;
        const chars = text.length;
        this.editorStats.textContent = `Lines: ${lines} | Characters: ${chars}`;
    }

    runFullPipeline() {
        const sourceCode = this.sourceCodeEditor.value;
        const startTime = performance.now();

        // 1. Lexical Analysis
        this.lexer = new Lexer(sourceCode);
        const { tokens, errors: lexErrors } = this.lexer.tokenize();

        // 2. Syntax Analysis (Parser)
        this.parser = new Parser(tokens);
        const { ast, errors: parseErrors } = this.parser.parse();

        // 3. Semantic Analysis
        const { diagnostics: semDiagnostics, scopes, hasErrors: hasSemErrors } = this.semanticAnalyzer.analyze(ast);

        // All diagnostics combined
        const allDiagnostics = [
            ...lexErrors.map(e => ({ severity: 'error', message: `Lexical Error: ${e.message}`, line: e.line, col: e.col, tip: 'Check character spelling' })),
            ...parseErrors.map(e => ({ severity: 'error', message: `Syntax Error: ${e.message}`, line: e.line, col: e.col, tip: 'Verify grammar punctuation (; or brackets)' })),
            ...semDiagnostics
        ];

        // 4. Intermediate Code Generation
        const shouldOptimize = this.chkOptimize ? this.chkOptimize.checked : false;
        const tacResult = this.icg.generate(ast, shouldOptimize);

        // 5. Target Execution VM Preparation
        this.vm.load(tacResult.instructions);

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        this.currentCompilation = {
            sourceCode,
            tokens,
            ast,
            scopes,
            diagnostics: allDiagnostics,
            tac: tacResult,
            duration
        };

        // Render UI panels
        this.renderTokensUI(tokens);
        this.renderAstUI(ast);
        this.renderSemanticsUI(scopes, allDiagnostics);
        this.renderIcgUI(tacResult);
        this.updateVMUI(this.vm.getState());

        // Update overall status badge
        const errorCount = allDiagnostics.filter(d => d.severity === 'error').length;
        const warningCount = allDiagnostics.filter(d => d.severity === 'warning').length;

        if (errorCount > 0) {
            this.statusBadge.textContent = `${errorCount} Error(s) found`;
            this.statusBadge.className = 'status-pill error';
        } else if (warningCount > 0) {
            this.statusBadge.textContent = `Compiled with ${warningCount} warning(s) (${duration}ms)`;
            this.statusBadge.className = 'status-pill warning';
        } else {
            this.statusBadge.textContent = `Compiled Successfully (${duration}ms)`;
            this.statusBadge.className = 'status-pill success';
        }
    }

    renderTokensUI(tokens) {
        if (!this.tokenCardsContainer || !this.tokenTableBody) return;

        this.tokenCountBadge.textContent = `${tokens.length} Tokens`;

        // Render mini-badges preview (first 60)
        let badgesHtml = '';
        const previewTokens = tokens.slice(0, 60);
        previewTokens.forEach(t => {
            const typeClass = t.type.toLowerCase().replace(/_/g, '-');
            badgesHtml += `<span class="token-chip ${typeClass}" title="${t.type} @ line ${t.line}:${t.col}">
                <span class="chip-type">${t.type.replace('KEYWORD_', 'KW_').replace('LITERAL_', 'LIT_')}</span>
                <span class="chip-val">${escapeHtml(String(t.value))}</span>
            </span>`;
        });
        if (tokens.length > 60) {
            badgesHtml += `<span class="token-chip more">+${tokens.length - 60} more...</span>`;
        }
        this.tokenCardsContainer.innerHTML = badgesHtml;

        // Render full token table
        let rowsHtml = '';
        tokens.forEach((t, idx) => {
            rowsHtml += `<tr>
                <td><span class="idx-badge">${idx + 1}</span></td>
                <td><code class="token-val">${escapeHtml(String(t.value))}</code></td>
                <td><span class="token-type-pill ${t.type}">${t.type}</span></td>
                <td>Line ${t.line}:${t.col}</td>
                <td><code>${escapeHtml(t.pattern || '-')}</code></td>
            </tr>`;
        });
        this.tokenTableBody.innerHTML = rowsHtml;
    }

    filterTokenTable(query) {
        if (!this.tokenTableBody) return;
        query = query.toLowerCase();
        const rows = this.tokenTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    }

    renderAstUI(ast) {
        if (this.astVisualizer) {
            this.astVisualizer.render(ast);
        }
    }

    renderSemanticsUI(scopes, diagnostics) {
        // Render Symbol Table
        if (this.symbolTableBody) {
            let symRows = '';
            let totalSymbols = 0;

            scopes.forEach(scope => {
                scope.symbols.forEach(sym => {
                    totalSymbols++;
                    symRows += `<tr>
                        <td><strong>${escapeHtml(sym.name)}</strong></td>
                        <td><span class="badge ${sym.category}">${sym.category}</span></td>
                        <td><span class="type-pill ${sym.type}">${sym.type}</span></td>
                        <td><code>Scope #${sym.scopeId} (${scope.name})</code></td>
                        <td>Depth ${scope.depth}</td>
                        <td>Offset +${sym.offset}</td>
                        <td>Line ${sym.line}:${sym.col}</td>
                        <td>${sym.isInitialized ? '<span class="status-yes">✓ Yes</span>' : '<span class="status-no">✗ Unset</span>'}</td>
                    </tr>`;
                });
            });

            if (totalSymbols === 0) {
                symRows = `<tr><td colspan="8" class="text-center muted">No symbols declared.</td></tr>`;
            }
            this.symbolTableBody.innerHTML = symRows;
        }

        // Render Scope Tree
        if (this.scopeHierarchyTree) {
            let treeHtml = '<div class="scope-hierarchy">';
            scopes.forEach(scope => {
                const indent = scope.depth * 20;
                treeHtml += `<div class="scope-item" style="margin-left: ${indent}px">
                    <span class="scope-id">Scope #${scope.id}</span>
                    <span class="scope-name">${escapeHtml(scope.name)}</span>
                    <span class="scope-count">(${scope.symbols.size} symbol${scope.symbols.size === 1 ? '' : 's'})</span>
                </div>`;
            });
            treeHtml += '</div>';
            this.scopeHierarchyTree.innerHTML = treeHtml;
        }

        // Render Diagnostics
        if (this.diagnosticsList) {
            this.diagnosticsCountBadge.textContent = `${diagnostics.length} Issues`;
            let diagHtml = '';

            if (diagnostics.length === 0) {
                diagHtml = `<div class="diagnostic-clean">
                    <span class="clean-icon">✓</span>
                    <div>
                        <strong>Semantic Check Clean!</strong>
                        <p class="muted">No type violations, undeclared identifiers, or syntax errors detected.</p>
                    </div>
                </div>`;
            } else {
                diagnostics.forEach(d => {
                    diagHtml += `<div class="diagnostic-card ${d.severity}">
                        <div class="diag-header">
                            <span class="diag-badge ${d.severity}">${d.severity.toUpperCase()}</span>
                            <span class="diag-loc">Line ${d.line}:${d.col}</span>
                        </div>
                        <div class="diag-message">${escapeHtml(d.message)}</div>
                        ${d.tip ? `<div class="diag-tip">💡 <strong>Suggestion:</strong> ${escapeHtml(d.tip)}</div>` : ''}
                    </div>`;
                });
            }

            this.diagnosticsList.innerHTML = diagHtml;
        }
    }

    renderIcgUI(tacResult) {
        // Raw TAC text
        if (this.tacOutput) {
            this.tacOutput.textContent = tacResult.tacString || '// No intermediate code generated';
        }

        // Quadruples
        if (this.quadruplesTableBody) {
            let quadHtml = '';
            tacResult.quadruples.forEach(q => {
                quadHtml += `<tr>
                    <td><code>(${q.index})</code></td>
                    <td><strong class="op-cell">${escapeHtml(q.op)}</strong></td>
                    <td><code>${escapeHtml(q.arg1 || '-')}</code></td>
                    <td><code>${escapeHtml(q.arg2 || '-')}</code></td>
                    <td><code class="res-cell">${escapeHtml(q.result || '-')}</code></td>
                </tr>`;
            });
            this.quadruplesTableBody.innerHTML = quadHtml;
        }

        // Triples
        if (this.triplesTableBody) {
            let tripHtml = '';
            tacResult.triples.forEach(t => {
                tripHtml += `<tr>
                    <td><code>(${t.index})</code></td>
                    <td><strong class="op-cell">${escapeHtml(t.op)}</strong></td>
                    <td><code>${escapeHtml(t.arg1 || '-')}</code></td>
                    <td><code>${escapeHtml(t.arg2 || '-')}</code></td>
                </tr>`;
            });
            this.triplesTableBody.innerHTML = tripHtml;
        }

        // Basic Blocks
        if (this.basicBlocksContainer) {
            let bbHtml = '';
            tacResult.basicBlocks.forEach(bb => {
                bbHtml += `<div class="basic-block-card">
                    <div class="bb-header">
                        <span class="bb-title">${bb.name}</span>
                        <span class="bb-stats">${bb.instructions.length} instrs</span>
                    </div>
                    <div class="bb-edges">
                        ${bb.predecessors.length > 0 ? `<span class="edge-pred">Pred: B${bb.predecessors.join(', B')}</span>` : ''}
                        ${bb.successors.length > 0 ? `<span class="edge-succ">Succ: B${bb.successors.join(', B')}</span>` : ''}
                    </div>
                    <div class="bb-body">
                        ${bb.instructions.map(inst => `<code>${escapeHtml(inst.toString())}</code>`).join('\n')}
                    </div>
                </div>`;
            });
            this.basicBlocksContainer.innerHTML = bbHtml;
        }
    }

    updateVMUI(state, activeInst = null) {
        if (!this.vmStatusBadge) return;

        this.vmStatusBadge.textContent = state.status;
        this.vmStatusBadge.className = `status-pill ${state.status.toLowerCase()}`;

        // Update Terminal stdout
        if (this.vmStdout) {
            if (state.output.length === 0) {
                this.vmStdout.innerHTML = `<span class="stdout-prompt">$ ready</span>`;
            } else {
                let outHtml = `<span class="stdout-prompt">$ program output:</span>\n`;
                state.output.forEach(line => {
                    outHtml += `<span class="stdout-line">${escapeHtml(line)}</span>\n`;
                });
                if (state.status === 'HALTED') {
                    outHtml += `<span class="stdout-end">-- Program finished with exit code 0 --</span>`;
                }
                if (state.status === 'ERROR') {
                    outHtml += `<span class="stdout-error">!! ${escapeHtml(state.errorMessage || 'Runtime Error')} !!</span>`;
                }
                this.vmStdout.innerHTML = outHtml;
                this.vmStdout.scrollTop = this.vmStdout.scrollHeight;
            }
        }

        // Update VM variable watch
        if (this.vmEnvTableBody) {
            let envHtml = '';
            const keys = Object.keys(state.env);
            if (keys.length === 0) {
                envHtml = `<tr><td colspan="3" class="muted text-center">No variables initialized yet.</td></tr>`;
            } else {
                keys.forEach(key => {
                    const val = state.env[key];
                    const typeOfVal = typeof val;
                    envHtml += `<tr>
                        <td><code>${escapeHtml(key)}</code></td>
                        <td><span class="type-pill ${typeOfVal}">${typeOfVal}</span></td>
                        <td><strong>${escapeHtml(String(val))}</strong></td>
                    </tr>`;
                });
            }
            this.vmEnvTableBody.innerHTML = envHtml;
        }

        // Highlight active instruction in TAC table
        if (this.tacOutput && this.currentCompilation && this.currentCompilation.tac) {
            const insts = this.currentCompilation.tac.instructions;
            let formattedTac = '';
            insts.forEach((inst, idx) => {
                const isCurrent = idx === state.ip;
                formattedTac += `${isCurrent ? '▶ ' : '  '}${idx.toString().padStart(3, ' ')}: ${inst.toString()}\n`;
            });
            this.tacOutput.textContent = formattedTac;
        }
    }

    analyzeGrammar() {
        const rawText = this.grammarEditor.value;
        this.currentGrammar = new Grammar(rawText);

        // Update Grammar Status
        if (this.currentGrammar.isLL1) {
            this.grammarStatusBadge.textContent = 'Grammar is LL(1) Valid';
            this.grammarStatusBadge.className = 'status-pill success';
            this.grammarConflictsAlert.style.display = 'none';
        } else {
            this.grammarStatusBadge.textContent = `Non-LL(1) (${this.currentGrammar.conflicts.length} conflict(s))`;
            this.grammarStatusBadge.className = 'status-pill error';
            this.grammarConflictsAlert.style.display = 'block';

            let conflictDetails = `<strong>Parsing Table Conflicts Detected:</strong><ul>`;
            this.currentGrammar.conflicts.forEach(c => {
                conflictDetails += `<li>Cell M[${escapeHtml(c.nonTerminal)}, ${escapeHtml(c.terminal)}]: multiple rules [${c.productions.map(p => p.toString()).join(' vs ')}]</li>`;
            });
            conflictDetails += `</ul>`;
            this.grammarConflictsAlert.innerHTML = conflictDetails;
        }

        // Render FIRST & FOLLOW sets
        if (this.firstFollowTableBody) {
            let ffHtml = '';
            for (const nt of this.currentGrammar.nonTerminals) {
                const firstSet = Array.from(this.currentGrammar.firstSets.get(nt) || []).join(', ');
                const followSet = Array.from(this.currentGrammar.followSets.get(nt) || []).join(', ');

                ffHtml += `<tr>
                    <td><strong>${escapeHtml(nt)}</strong></td>
                    <td><code>{ ${escapeHtml(firstSet)} }</code></td>
                    <td><code>{ ${escapeHtml(followSet)} }</code></td>
                </tr>`;
            }
            this.firstFollowTableBody.innerHTML = ffHtml;
        }

        // Render Parse Table
        if (this.parseTableContainer) {
            const allCols = Array.from(this.currentGrammar.terminals).concat([EOF_SYMBOL]);
            let tableHtml = `<table class="matrix-table">
                <thead>
                    <tr>
                        <th>Non-Terminal</th>
                        ${allCols.map(c => `<th><code>${escapeHtml(c)}</code></th>`).join('')}
                    </tr>
                </thead>
                <tbody>`;

            for (const nt of this.currentGrammar.nonTerminals) {
                const row = this.currentGrammar.parseTable.get(nt);
                tableHtml += `<tr><td><strong>${escapeHtml(nt)}</strong></td>`;
                for (const col of allCols) {
                    const prods = row ? row.get(col) || [] : [];
                    if (prods.length === 0) {
                        tableHtml += `<td class="empty-cell">-</td>`;
                    } else if (prods.length === 1) {
                        tableHtml += `<td class="prod-cell"><code>${escapeHtml(prods[0].toString())}</code></td>`;
                    } else {
                        // Conflict cell!
                        tableHtml += `<td class="conflict-cell"><code>${prods.map(p => escapeHtml(p.toString())).join('<br>')}</code></td>`;
                    }
                }
                tableHtml += `</tr>`;
            }

            tableHtml += `</tbody></table>`;
            this.parseTableContainer.innerHTML = tableHtml;
        }
    }

    simulateDerivation() {
        if (!this.currentGrammar) {
            this.analyzeGrammar();
        }

        const inputStr = this.inputDerivationString.value;
        const result = this.currentGrammar.simulateLL1Parse(inputStr);

        if (this.parseSimulationResult) {
            if (result.success) {
                this.parseSimulationResult.textContent = `String accepted in ${result.steps.length} derivation step(s)!`;
                this.parseSimulationResult.className = 'derivation-result success';
            } else {
                this.parseSimulationResult.textContent = `String rejected: ${result.errorMessage || 'Parsing failed'}`;
                this.parseSimulationResult.className = 'derivation-result error';
            }
        }

        if (this.parseSimulationTableBody) {
            let traceHtml = '';
            result.steps.forEach(s => {
                const actionClass = s.error ? 'act-error' : (s.success ? 'act-success' : '');
                traceHtml += `<tr>
                    <td><code>${s.step}</code></td>
                    <td><code>${escapeHtml(s.stack)}</code></td>
                    <td><code>${escapeHtml(s.input)}</code></td>
                    <td class="${actionClass}"><strong>${escapeHtml(s.action)}</strong></td>
                </tr>`;
            });
            this.parseSimulationTableBody.innerHTML = traceHtml;
        }
    }

    exportAnalysisReport() {
        if (!this.currentCompilation) return;

        const report = {
            title: "Automated Syntax & Semantic Processing System - Compilation Report",
            timestamp: new Date().toISOString(),
            metrics: {
                durationMs: this.currentCompilation.duration,
                tokenCount: this.currentCompilation.tokens.length,
                diagnosticsCount: this.currentCompilation.diagnostics.length
            },
            sourceCode: this.currentCompilation.sourceCode,
            tokens: this.currentCompilation.tokens.map(t => ({ type: t.type, value: t.value, line: t.line, col: t.col })),
            diagnostics: this.currentCompilation.diagnostics,
            threeAddressCode: this.currentCompilation.tac.tacString
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compiler_analysis_report_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new CompilerApp();
});
