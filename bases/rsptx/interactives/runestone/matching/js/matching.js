import RunestoneBase from "../../common/js/runestonebase.js";
import "../css/matching.less";
import convert from "xml-js";

class MatchingProblem extends RunestoneBase {
    constructor(container, boxData) {
        super({})
        this.containerDiv = container;
        this.div_id = container.id;
        this.boxData = boxData;
        this.workspace = this.createWorkspace(container);
        this.connList = this.createConnList(container);
        this.ariaLive = this.createAriaLive(container);
        this.controlDiv = this.createControlDiv(container);

        this.connections = [];
        this.allBoxes = [];
        this.selectedBox = null;
        this.startBox = null;
        this.tempLine = null;

        this.init();
        this.checkServer("matching", true);
    }

    init() {
        this.shuffle(this.boxData.left);
        this.shuffle(this.boxData.right);

        this.renderBoxes();
        this.attachEvents();

        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise();
        }
    }

    // required elements for a Runestone component

    checkCurrentAnswer() {
        const correctAnswers = this.boxData.correctAnswers;
        const actual = this.connections.map(conn => [
            conn.fromBox.dataset.id,
            conn.toBox.dataset.id
        ]);

        const correctMatches = correctAnswers.filter(expected =>
            actual.some(given => given[0] === expected[0] && given[1] === expected[1])
        );

        const incorrectConnections = actual.filter(given =>
            !correctAnswers.some(expected => expected[0] === given[0] && expected[1] === given[1])
        );

        this.correctCount = correctMatches.length;
        this.incorrectCount = incorrectConnections.length;
        this.missingCount = correctAnswers.length - this.correctCount;
        this.denominator = this.correctCount + this.incorrectCount + this.missingCount;
        this.scorePercent = this.denominator === 0 ? 0 : Math.max(0, Math.min(100, Math.round((this.correctCount / this.denominator) * 100)));

    }

    async logCurrentAnswer(eventData) {
        eventData.event = "matching";
        eventData.div_id = this.div_id;
        eventData.act = `score:${eventData.score} connections:${eventData.connections}`;
        eventData.correct = eventData.score === 100;
        eventData.answer = eventData.connections;

        await this.logBookEvent(eventData);

    }

    renderFeedback() {
        this.connections.forEach(conn => {
            const idPair = [conn.fromBox.dataset.id, conn.toBox.dataset.id];
            const isCorrect = this.boxData.correctAnswers.some(expected =>
                expected[0] === idPair[0] && expected[1] === idPair[1]
            );
            conn.line.classList.remove("correct", "incorrect");
            conn.line.classList.add(isCorrect ? "correct" : "incorrect");
        });

        this.connList.innerHTML = `<strong>Score: ${this.scorePercent}%</strong>`;
    }

    restoreAnswers() {
        // Recreate lines
        this.connections.forEach(conn => {
            const from = this.getCenter(conn.fromBox);
            const to = this.getCenter(conn.toBox);
            const line = this.createLineElement(from.x, from.y, to.x, to.y);
            line.fromBox = conn.fromBox;
            line.toBox = conn.toBox;
            this.svg.appendChild(line);
            conn.line = line;
        });

    }
    checkLocalStorage() {
        if (this.graderactive) {
            return;
        }
        const data = localStorage.getItem(this.div_id);
        if (data) {
            const parsedData = JSON.parse(data);
            this.connections = parsedData.connections.map(conn => ({
                fromBox: this.allBoxes.find(box => box.dataset.id === conn.from),
                toBox: this.allBoxes.find(box => box.dataset.id === conn.to)
            }));
            this.updateConnectionModel();
            this.correctCount = parsedData.correctCount;
            this.incorrectCount = parsedData.incorrectCount;
            this.missingCount = parsedData.missingCount;
            this.scorePercent = parsedData.score;
            this.restoreAnswers();
            this.renderFeedback();
        }
    }
    setLocalStorage() {
        const data = {
            connections: this.connections.map(conn => ({
                from: conn.fromBox.dataset.id,
                to: conn.toBox.dataset.id
            })),
            score: this.scorePercent,
            correctCount: this.correctCount,
            incorrectCount: this.incorrectCount,
            missingCount: this.missingCount
        };
        localStorage.setItem(this.div_id, JSON.stringify(data));
    }

    disableInteraction() { }

    createWorkspace(container) {
        const workspace = document.createElement('div');
        workspace.className = 'matching-workspace';

        const leftColumn = document.createElement('div');
        leftColumn.className = 'left-column';
        this.leftColumn = leftColumn;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add('connector-svg');
        this.svg = svg;

        const rightColumn = document.createElement('div');
        rightColumn.className = 'right-column';
        this.rightColumn = rightColumn;
        workspace.appendChild(leftColumn);
        workspace.appendChild(svg);
        workspace.appendChild(rightColumn);

        container.insertBefore(workspace, container.firstChild);
        return workspace;
    }

    createConnList(container) {
        const connList = document.createElement('div');
        connList.className = 'conn-list';
        connList.innerHTML = "<strong>Connections:</strong><br>";
        container.appendChild(connList);
        return connList;
    }

    createAriaLive(container) {
        const ariaLive = document.createElement('div');
        ariaLive.className = 'aria-live';
        ariaLive.setAttribute('aria-live', 'polite');
        ariaLive.setAttribute('aria-atomic', 'true');
        container.appendChild(ariaLive);
        return ariaLive;
    }

    createControlDiv(container) {
        const controlDiv = document.createElement('div');
        controlDiv.className = 'control-div';
        const gradeBtn = document.createElement('button');
        gradeBtn.className = 'grade-button';
        gradeBtn.textContent = 'Grade';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-button';
        resetBtn.textContent = 'Reset';
        controlDiv.appendChild(gradeBtn);
        controlDiv.appendChild(resetBtn);
        container.appendChild(controlDiv);
        return controlDiv;
    }

    // Utility functions
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    renderBoxes() {
        this.boxData.left.forEach(({ id, label }) => {
            const box = this.createBox(id, label, "drag");
            this.leftColumn.appendChild(box);
            this.allBoxes.push(box);
        });

        this.boxData.right.forEach(({ id, label }) => {
            const box = this.createBox(id, label, "drop");
            this.rightColumn.appendChild(box);
            this.allBoxes.push(box);
        });
    }

    createBox(id, label, role) {
        const div = document.createElement('div');
        div.className = 'box';
        div.dataset.id = id;
        div.dataset.role = role;
        div.innerHTML = label;
        div.tabIndex = 0;
        div.setAttribute('role', 'button');
        div.setAttribute('aria-label', `${role === "drag" ? "Draggable" : "Droppable"}: ${label}`);
        return div;
    }

    getCenter(el) {
        const elRect = el.getBoundingClientRect();
        const containerRect = this.workspace.getBoundingClientRect();
        return {
            x: elRect.left - containerRect.left + elRect.width / 2,
            y: elRect.top - containerRect.top + elRect.height / 2
        };
    }
    createLineElement(x1, y1, x2, y2) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("class", "line");

        line.addEventListener("click", () => {
            this.svg.removeChild(line);
            const index = this.connections.findIndex(conn =>
                (conn.fromBox === line.fromBox && conn.toBox === line.toBox) ||
                (conn.fromBox === line.toBox && conn.toBox === line.fromBox)
            );
            if (index !== -1) this.connections.splice(index, 1);
            this.updateConnectionModel();
        });

        return line;
    }

    isConnected(a, b) {
        return this.connections.some(conn =>
            (conn.fromBox === a && conn.toBox === b) ||
            (conn.fromBox === b && conn.toBox === a)
        );
    }

    createPermanentLine(fromBox, toBox) {
        const fromRole = fromBox.dataset.role;
        const toRole = toBox.dataset.role;

        if (fromRole === toRole) {
            alert("You can only connect a draggable to a droppable.");
            return;
        }

        if (this.isConnected(fromBox, toBox)) return;

        const from = this.getCenter(fromBox);
        const to = this.getCenter(toBox);
        const line = this.createLineElement(from.x, from.y, to.x, to.y);

        line.fromBox = fromBox;
        line.toBox = toBox;

        this.svg.appendChild(line);
        this.connections.push({ fromBox, toBox, line });
        this.updateConnectionModel();

        if (this.ariaLive) {
            this.ariaLive.textContent = `Connected ${fromBox.textContent} to ${toBox.textContent}`;
        }
    }

    updateConnectionModel() {
        this.connList.innerHTML = "<strong>Connections:</strong><br>";
        this.connections.forEach(conn => {
            const fromLabel = conn.fromBox.textContent;
            const toLabel = conn.toBox.textContent;
            const line = document.createElement('div');
            line.className = 'conn-entry';
            line.textContent = `${fromLabel} → ${toLabel}`;
            this.connList.appendChild(line);
        });
    }

    /*
    * This method grades the connections made by the user.
    * It checks the current answer against the correct answers,
    * renders feedback, and logs the current answer.
    * It also updates the local storage with the current state.
    * It is called when the user clicks the "Grade" button.
    */
    gradeConnections() {
        this.checkCurrentAnswer();
        this.renderFeedback();
        this.logCurrentAnswer({
            score: this.scorePercent,
            correctCount: this.correctCount,
            incorrectCount: this.incorrectCount,
            missingCount: this.missingCount,
            connections: this.connections.map(conn => ({
                from: conn.fromBox.dataset.id,
                to: conn.toBox.dataset.id
            }))
        });
        this.setLocalStorage();
    }

    resetConnections() {
        this.connections.forEach(conn => {
            if (conn.line && conn.line.parentNode === this.svg) {
                this.svg.removeChild(conn.line);
            }
        });
        this.connections.length = 0;
        this.updateConnectionModel();
        if (this.ariaLive) this.ariaLive.textContent = "All connections have been cleared.";
    }

    attachEvents() {
        this.allBoxes.forEach(box => {
            box.addEventListener("mousedown", e => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.startBox = box;
                    const from = this.getCenter(this.startBox);
                    this.tempLine = this.createLineElement(from.x, from.y, from.x, from.y);
                    this.tempLine.setAttribute("stroke", "gray");
                    this.tempLine.setAttribute("stroke-dasharray", "4");
                    this.svg.appendChild(this.tempLine);

                    document.addEventListener("mousemove", this.updateTempLine);
                    document.addEventListener("mouseup", this.finishConnection);
                }
            });

            box.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (!this.selectedBox) {
                        this.selectedBox = box;
                        box.classList.add("selected");
                    } else {
                        if (box !== this.selectedBox) this.createPermanentLine(this.selectedBox, box);
                        this.selectedBox.classList.remove("selected");
                        this.selectedBox = null;
                        const currentIndex = this.allBoxes.indexOf(box);
                        const next = this.allBoxes[currentIndex + 1];
                        if (next) next.focus();
                        else this.allBoxes[0].focus();
                    }
                }
            });

            box.addEventListener("mouseenter", () => {
                this.connections.forEach(conn => {
                    if (conn.fromBox === box || conn.toBox === box) {
                        conn.line.classList.add("highlighted");
                        conn.line.classList.remove("faded");
                    } else {
                        conn.line.classList.add("faded");
                        conn.line.classList.remove("highlighted");
                    }
                });
            });

            box.addEventListener("mouseleave", () => {
                this.connections.forEach(conn => {
                    conn.line.classList.remove("highlighted", "faded");
                });
            });
        });

        const gradeBtn = this.containerDiv.querySelector('.grade-button');
        const resetBtn = this.containerDiv.querySelector('.reset-button');
        if (gradeBtn) gradeBtn.addEventListener('click', () => this.gradeConnections());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetConnections());

        window.addEventListener("resize", () => {
            this.connections.forEach(conn => {
                const from = this.getCenter(conn.fromBox);
                const to = this.getCenter(conn.toBox);
                conn.line.setAttribute("x1", from.x);
                conn.line.setAttribute("y1", from.y);
                conn.line.setAttribute("x2", to.x);
                conn.line.setAttribute("y2", to.y);
            });
        });
    }

    updateTempLine = (e) => {
        if (!this.startBox || !this.tempLine) return;
        const from = this.getCenter(this.startBox);
        this.tempLine.setAttribute("x1", from.x);
        this.tempLine.setAttribute("y1", from.y);
        const containerRect = this.workspace.getBoundingClientRect();
        const x = e.clientX - containerRect.left;
        const y = e.clientY - containerRect.top;

        this.tempLine.setAttribute("x2", x);
        this.tempLine.setAttribute("y2", y);
    };

    finishConnection = (e) => {
        if (this.tempLine) {
            this.svg.removeChild(this.tempLine);
            this.tempLine = null;
        }

        const endBox = this.allBoxes.find(box => box.contains(e.target) && box !== this.startBox);
        if (this.startBox && endBox) this.createPermanentLine(this.startBox, endBox);

        this.startBox = null;
        document.removeEventListener("mousemove", this.updateTempLine);
        document.removeEventListener("mouseup", this.finishConnection);
    }
}

function simplifyJson(json) {
    const unwrapKeys = new Set(['left', 'right', 'correctAnswers']);

    // all the HTML tag names you expect to see
    const htmlTags = new Set([
        'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen',
        'link', 'meta', 'param', 'source', 'track', 'wbr',
        'em', 'span', 'p', 'div', 'strong', 'i', 'b', 'u', 'a', 'code', 'pre',
        'blockquote', 'ol', 'ul', 'li', 'dl', 'dt', 'dd', 'table', 'tr', 'th', 'td',
        'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    ]);

    function formatAttrs(attrs) {
        if (!attrs || typeof attrs !== 'object') return '';
        return ' ' + Object.entries(attrs)
            .map(([k, v]) => `${k}="${v}"`)
            .join('');
    }

    function flattenHtml(node) {
        let out = '';
        for (const key of Object.keys(node)) {
            if (key === '_attributes') continue;
            const val = node[key];
            if (key === '_text') {
                out += val;
            } else if (htmlTags.has(key) && typeof val === 'object') {
                // recurse into the child
                const attrs = formatAttrs(val._attributes);
                const inner = flattenHtml(val);
                // void vs. normal tags
                if (['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input',
                    'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']
                    .includes(key)) {
                    out += `<${key}${attrs} />`;
                } else {
                    out += `<${key}${attrs}>${inner}</${key}>`;
                }
            }
        }
        // put a space where tags butt together
        return out.replace(/>(?=<)/g, '> ');
    }

    function simplifyNode(node) {
        if (node === null || typeof node !== 'object') {
            return node;
        }
        if (Array.isArray(node)) {
            return node.map(simplifyNode);
        }

        const keys = Object.keys(node);
        // pure text leaf
        if (keys.length === 1 && keys[0] === '_text') {
            return node._text;
        }
        // detect any HTML tag keys → flatten entire node
        if (keys.some(k => htmlTags.has(k))) {
            return flattenHtml(node);
        }
        // otherwise, a normal object
        const out = {};
        for (const k of keys) {
            out[k] = simplifyNode(node[k]);
        }
        return out;
    }

    const result = {};
    for (const [section, val] of Object.entries(json)) {
        const simp = simplifyNode(val);
        if (unwrapKeys.has(section) && simp && simp.item) {
            if (section === 'correctAnswers') {
                result[section] = simp.item.map(p =>
                    Array.isArray(p.item) ? p.item : p
                );
            } else {
                result[section] = simp.item;
            }
        } else {
            result[section] = simp;
        }
    }
    return result;
}

// Register the component with Runestone 
document.addEventListener("runestone:login-complete", () => {
    document.querySelectorAll('[data-component="matching"]').forEach(container => {
        const script = container.querySelector('script');
        if (script) {
            let boxData;
            try {
                if (script.type == 'text/xml') {
                    const xml = script.textContent;
                    const json = convert.xml2json(xml, { compact: true, spaces: 4 });
                    boxData = JSON.parse(json);
                    boxData = simplifyJson(boxData.all);
                } else {
                    boxData = JSON.parse(script.textContent);
                }

                window.componentMap[container.id] = new MatchingProblem(container, boxData);
            } catch (err) {
                console.error("Failed to parse boxData JSON:", err);
            }
        }
    });
});