/**
 * Tree & Graph Visualizer
 * Renders interactive SVG Abstract Syntax Trees (AST) and Control Flow Graphs (CFG)
 * with zoom, pan, node inspection, and hierarchical auto-layout.
 */

import {
    ProgramNode, VarDeclNode, AssignNode, BinaryOpNode,
    UnaryOpNode, LiteralNode, IdentifierNode, BlockNode,
    IfNode, WhileNode, PrintNode, FunctionDeclNode, ReturnNode, CallNode
} from './parser.js';

export class ASTVisualizer {
    constructor(svgElement, infoPanelElement) {
        this.svg = svgElement;
        this.infoPanel = infoPanelElement;
        this.zoom = 1;
        this.panX = 50;
        this.panY = 50;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.currentAST = null;
        this.selectedNode = null;

        this.initEvents();
    }

    initEvents() {
        if (!this.svg) return;

        this.svg.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ast-node-group')) return; // Ignore click on nodes
            this.isPanning = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.svg.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this.updateTransform();
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.svg.style.cursor = 'grab';
            }
        });

        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
            this.applyZoom(zoomFactor, e.clientX, e.clientY);
        }, { passive: false });
    }

    applyZoom(factor, clientX = null, clientY = null) {
        const newZoom = Math.min(Math.max(this.zoom * factor, 0.25), 3.0);

        if (clientX !== null && clientY !== null) {
            const rect = this.svg.getBoundingClientRect();
            const mouseX = clientX - rect.left;
            const mouseY = clientY - rect.top;

            this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
            this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        }

        this.zoom = newZoom;
        this.updateTransform();
    }

    zoomIn() { this.applyZoom(1.2); }
    zoomOut() { this.applyZoom(0.8); }
    resetView() {
        this.zoom = 0.9;
        this.panX = 100;
        this.panY = 40;
        this.updateTransform();
    }

    updateTransform() {
        const rootGroup = this.svg.querySelector('#ast-root-group');
        if (rootGroup) {
            rootGroup.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
        }
    }

    render(ast) {
        this.currentAST = ast;
        if (!this.svg) return;

        this.svg.innerHTML = '';
        if (!ast) {
            this.svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="14">No AST to display. Compile some code first.</text>`;
            return;
        }

        // Convert AST to hierarchical layout structure
        const hierarchy = this.buildHierarchy(ast);
        this.layoutTree(hierarchy);

        // SVG Root Group
        const rootGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        rootGroup.setAttribute('id', 'ast-root-group');
        rootGroup.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);

        // Render Links
        const linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        linksGroup.setAttribute('class', 'ast-links');
        this.renderLinks(hierarchy, linksGroup);
        rootGroup.appendChild(linksGroup);

        // Render Nodes
        const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodesGroup.setAttribute('class', 'ast-nodes');
        this.renderNodes(hierarchy, nodesGroup);
        rootGroup.appendChild(nodesGroup);

        this.svg.appendChild(rootGroup);
    }

    buildHierarchy(node) {
        if (!node) return null;

        let label = node.type;
        let sublabel = '';
        let category = 'default';

        if (node instanceof ProgramNode) {
            label = 'Program';
            category = 'program';
            const children = (node.body || []).map(b => this.buildHierarchy(b)).filter(Boolean);
            return { raw: node, label, sublabel: `${children.length} stmts`, category, children };
        }

        if (node instanceof VarDeclNode) {
            label = `VarDecl (${node.varType})`;
            sublabel = node.name;
            category = 'decl';
            const children = [];
            if (node.initializer) children.push(this.buildHierarchy(node.initializer));
            return { raw: node, label, sublabel, category, children };
        }

        if (node instanceof AssignNode) {
            label = `Assign (=)`;
            sublabel = node.name;
            category = 'stmt';
            const children = [this.buildHierarchy(node.value)].filter(Boolean);
            return { raw: node, label, sublabel, category, children };
        }

        if (node instanceof BinaryOpNode) {
            label = `Op: ${node.op}`;
            category = 'operator';
            const children = [this.buildHierarchy(node.left), this.buildHierarchy(node.right)].filter(Boolean);
            return { raw: node, label, sublabel: node.inferredType ? `:${node.inferredType}` : '', category, children };
        }

        if (node instanceof UnaryOpNode) {
            label = `Unary: ${node.op}`;
            category = 'operator';
            const children = [this.buildHierarchy(node.operand)].filter(Boolean);
            return { raw: node, label, sublabel: '', category, children };
        }

        if (node instanceof LiteralNode) {
            label = `Literal (${node.literalType})`;
            sublabel = typeof node.value === 'string' ? `"${node.value}"` : String(node.value);
            category = 'literal';
            return { raw: node, label, sublabel, category, children: [] };
        }

        if (node instanceof IdentifierNode) {
            label = 'Id';
            sublabel = node.name;
            category = 'identifier';
            return { raw: node, label, sublabel, category, children: [] };
        }

        if (node instanceof BlockNode) {
            label = 'Block';
            category = 'stmt';
            const children = (node.statements || []).map(s => this.buildHierarchy(s)).filter(Boolean);
            return { raw: node, label, sublabel: `{ ${children.length} }`, category, children };
        }

        if (node instanceof IfNode) {
            label = 'If';
            category = 'control';
            const children = [this.buildHierarchy(node.condition), this.buildHierarchy(node.thenBranch)];
            if (node.elseBranch) children.push(this.buildHierarchy(node.elseBranch));
            return { raw: node, label, sublabel: '', category, children: children.filter(Boolean) };
        }

        if (node instanceof WhileNode) {
            label = 'While';
            category = 'control';
            const children = [this.buildHierarchy(node.condition), this.buildHierarchy(node.body)].filter(Boolean);
            return { raw: node, label, sublabel: '', category, children };
        }

        if (node instanceof PrintNode) {
            label = 'Print';
            category = 'stmt';
            const children = [this.buildHierarchy(node.expression)].filter(Boolean);
            return { raw: node, label, sublabel: '', category, children };
        }

        if (node instanceof FunctionDeclNode) {
            label = `func ${node.name}()`;
            sublabel = `-> ${node.returnType}`;
            category = 'decl';
            const children = [];
            if (node.body) children.push(this.buildHierarchy(node.body));
            return { raw: node, label, sublabel, category, children };
        }

        if (node instanceof ReturnNode) {
            label = 'Return';
            category = 'control';
            const children = node.value ? [this.buildHierarchy(node.value)].filter(Boolean) : [];
            return { raw: node, label, sublabel: '', category, children };
        }

        if (node instanceof CallNode) {
            const calleeName = node.callee && node.callee.name ? node.callee.name : 'func';
            label = `Call: ${calleeName}()`;
            category = 'call';
            const children = (node.args || []).map(a => this.buildHierarchy(a)).filter(Boolean);
            return { raw: node, label, sublabel: '', category, children };
        }

        return { raw: node, label, sublabel: '', category: 'default', children: [] };
    }

    layoutTree(root) {
        if (!root) return;

        const levelGap = 85;
        const siblingGap = 130;

        let nextX = 0;

        // Post-order traversal to calculate X coordinates
        const assignPositions = (node, depth = 0) => {
            node.y = depth * levelGap + 40;

            if (node.children.length === 0) {
                node.x = nextX;
                nextX += siblingGap;
            } else {
                for (const child of node.children) {
                    assignPositions(child, depth + 1);
                }
                const firstChild = node.children[0];
                const lastChild = node.children[node.children.length - 1];
                node.x = (firstChild.x + lastChild.x) / 2;
            }
        };

        assignPositions(root);
    }

    renderLinks(node, container) {
        if (!node) return;

        for (const child of node.children) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            // Cubic bezier curve for beautiful organic connections
            const d = `M ${node.x} ${node.y + 18} C ${node.x} ${(node.y + child.y) / 2}, ${child.x} ${(node.y + child.y) / 2}, ${child.x} ${child.y - 18}`;
            line.setAttribute('d', d);
            line.setAttribute('fill', 'none');
            line.setAttribute('stroke', '#334155');
            line.setAttribute('stroke-width', '2');
            container.appendChild(line);

            this.renderLinks(child, container);
        }
    }

    renderNodes(node, container) {
        if (!node) return;

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'ast-node-group');
        group.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        group.style.cursor = 'pointer';

        // Color theme mapping
        const colorMap = {
            program: { bg: '#1e293b', border: '#38bdf8', text: '#38bdf8' },
            decl: { bg: '#2e1065', border: '#a855f7', text: '#e9d5ff' },
            stmt: { bg: '#082f49', border: '#0284c7', text: '#bae6fd' },
            operator: { bg: '#3b0764', border: '#c084fc', text: '#f5d0fe' },
            literal: { bg: '#064e3b', border: '#10b981', text: '#a7f3d0' },
            identifier: { bg: '#713f12', border: '#f59e0b', text: '#fde68a' },
            control: { bg: '#4c0519', border: '#f43f5e', text: '#fecdd3' },
            call: { bg: '#14532d', border: '#22c55e', text: '#bbf7d0' },
            default: { bg: '#1e293b', border: '#64748b', text: '#cbd5e1' }
        };

        const theme = colorMap[node.category] || colorMap.default;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '-55');
        rect.setAttribute('y', '-18');
        rect.setAttribute('width', '110');
        rect.setAttribute('height', '36');
        rect.setAttribute('rx', '8');
        rect.setAttribute('fill', theme.bg);
        rect.setAttribute('stroke', theme.border);
        rect.setAttribute('stroke-width', '1.5');
        group.appendChild(rect);

        // Primary text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', node.sublabel ? '-2' : '4');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', theme.text);
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', '600');
        text.setAttribute('font-family', 'JetBrains Mono, monospace');
        text.textContent = node.label.length > 15 ? node.label.substring(0, 14) + '…' : node.label;
        group.appendChild(text);

        // Sublabel text (e.g. value, identifier name, type)
        if (node.sublabel) {
            const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            sub.setAttribute('x', '0');
            sub.setAttribute('y', '12');
            sub.setAttribute('text-anchor', 'middle');
            sub.setAttribute('fill', '#94a3b8');
            sub.setAttribute('font-size', '9.5');
            sub.setAttribute('font-family', 'JetBrains Mono, monospace');
            sub.textContent = node.sublabel.length > 16 ? node.sublabel.substring(0, 15) + '…' : node.sublabel;
            group.appendChild(sub);
        }

        // Click handler to inspect
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.inspectNode(node);
        });

        container.appendChild(group);

        for (const child of node.children) {
            this.renderNodes(child, container);
        }
    }

    inspectNode(node) {
        if (!this.infoPanel) return;
        const raw = node.raw;

        this.infoPanel.innerHTML = `
            <div class="node-inspector-card">
                <div class="inspector-header">
                    <span class="badge ${node.category}">${node.label}</span>
                    <span class="loc-badge">Line ${raw.line || 1}:${raw.col || 1}</span>
                </div>
                <div class="inspector-body">
                    <p><strong>AST Node:</strong> <code>${raw.type}</code></p>
                    ${raw.inferredType ? `<p><strong>Inferred Type:</strong> <span class="type-pill ${raw.inferredType}">${raw.inferredType}</span></p>` : ''}
                    ${raw.scopeId !== null && raw.scopeId !== undefined ? `<p><strong>Scope ID:</strong> <code>Scope #${raw.scopeId}</code></p>` : ''}
                    ${node.sublabel ? `<p><strong>Value / Target:</strong> <code>${node.sublabel}</code></p>` : ''}
                    <p><strong>Children:</strong> ${node.children.length} node(s)</p>
                </div>
            </div>
        `;
    }
}
