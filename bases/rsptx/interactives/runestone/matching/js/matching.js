import RunestoneBase from "../../common/js/runestonebase.js";
import "../css/matching.less";


class MatchingProblem extends RunestoneBase {
    constructor(container, boxData) {
        super({})
        this.container = container;
        this.boxData = boxData;
        //this.createWorkspace(container);
        this.workspace = container.querySelector('.matching-workspace');
        this.leftColumn = container.querySelector('.left-column');
        this.rightColumn = container.querySelector('.right-column');
        this.svg = container.querySelector('.connector-svg');
        this.connList = container.querySelector('.conn-list');
        this.ariaLive = container.querySelector('.aria-live');

        this.connections = [];
        this.allBoxes = [];
        this.selectedBox = null;
        this.startBox = null;
        this.tempLine = null;

        this.init();
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

    checkCurrentAnswer() { }
    logCurrentAnswer() { }
    renderFeedback() { }
    restoreAnswers() { }
    checkLocalStorage() { }
    setLocalStorage() { }
    disableInteraction() { }

    createWorkspace(container) {
        const workspace = document.createElement('div');
        workspace.className = 'matching-workspace';

        const leftColumn = document.createElement('div');
        leftColumn.className = 'left-column';

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add('svg-container');

        const rightColumn = document.createElement('div');
        rightColumn.className = 'right-column';

        workspace.appendChild(leftColumn);
        workspace.appendChild(svg);
        workspace.appendChild(rightColumn);

        container.insertBefore(workspace, container.firstChild);
    }

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

    gradeConnections() {
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

        const correctCount = correctMatches.length;
        const incorrectCount = incorrectConnections.length;
        const missingCount = correctAnswers.length - correctCount;
        const denominator = correctCount + incorrectCount + missingCount;
        const scorePercent = denominator === 0 ? 0 : Math.max(0, Math.min(100, Math.round((correctCount / denominator) * 100)));

        this.connections.forEach(conn => {
            const idPair = [conn.fromBox.dataset.id, conn.toBox.dataset.id];
            const isCorrect = correctAnswers.some(expected =>
                expected[0] === idPair[0] && expected[1] === idPair[1]
            );
            conn.line.classList.remove("correct", "incorrect");
            conn.line.classList.add(isCorrect ? "correct" : "incorrect");
        });

        this.connList.innerHTML = `<strong>Score: ${scorePercent}%</strong>`;
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

        const gradeBtn = this.container.querySelector('.grade-button');
        const resetBtn = this.container.querySelector('.reset-button');
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

document.addEventListener("runestone:login-complete", () => {
    document.querySelectorAll('[data-component="matching"]').forEach(container => {
        const script = container.querySelector('script[type="application/json"]');
        if (script) {
            try {
                const boxData = JSON.parse(script.textContent);
                window.componentMap[container.id] = new MatchingProblem(container, boxData);
            } catch (err) {
                console.error("Failed to parse boxData JSON:", err);
            }
        }
    });
});