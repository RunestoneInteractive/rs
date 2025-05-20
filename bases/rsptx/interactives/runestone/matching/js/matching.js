import RunestoneBase from "../../common/js/runestonebase.js";
import "../css/matching.less";
import { xmlToJson } from "./xmlconversion.js";
export class MatchingProblem extends RunestoneBase {
    constructor(opts) {
        super(opts)
        let container = opts.orig;
        this.containerDiv = opts.orig;
        const script = container.querySelector('script');
        if (script) {
            let boxData;
            try {
                // the script is called xml but may also contain some html for the statement.
                if (script.type == 'text/xml') {
                    const xml = script.textContent;
                    boxData = xmlToJson(xml);
                } else {
                    boxData = JSON.parse(script.textContent);
                }
                this.boxData = boxData;
            } catch (err) {
                console.error("Failed to parse boxData JSON:", err);
            }
        }

        this.divid = container.id;
        this.boxesRenderedPromise = new Promise((resolve) => {
            this.boxesRenderedResolve = resolve;
        });
        this.workspace = this.createWorkspace(container);
        this.statement = this.createStatement(container);
        this.connList = this.createConnList(container);
        this.ariaLive = this.createAriaLive(container);
        this.controlDiv = this.createControlDiv(container);
        this.createHelpModal();

        this.connections = [];
        this.allBoxes = [];
        this.selectedBox = null;
        this.startBox = null;
        this.tempLine = null;
        this.useRunestoneServices = eBookConfig.useRunestoneServices;
        this.graderactive = opts.graderactive || false;
        this.init();
        // ensure that boxes are rendered before checking server
        // if boxes are not rendered then we may have dangling lines
        // that are not connected to any boxes
        this.boxesRenderedPromise.then(() => {
            this.checkServer("matching", true);
        });
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

    async logCurrentAnswer() {
        let eventData = {
            score: this.scorePercent,
            correctCount: this.correctCount,
            incorrectCount: this.incorrectCount,
            missingCount: this.missingCount,
            connections: this.connections.map(conn => ({
                from: conn.fromBox.dataset.id,
                to: conn.toBox.dataset.id
            }))
        }
        eventData.event = "matching";
        eventData.div_id = this.divid;
        eventData.act = `score:${eventData.score} connections:${JSON.stringify(eventData.connections)}`;
        eventData.correct = eventData.score === 100;
        eventData.answer = JSON.stringify({ connections: eventData.connections });

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

        this.connList.innerHTML = `<strong>Score: ${this.scorePercent}%</strong><br>`;
        this.connList.innerHTML += `<br>Correct: ${this.correctCount}`;
        this.connList.innerHTML += `<br>Incorrect: ${this.incorrectCount}`;
        this.connList.innerHTML += `<br>Missing: ${this.missingCount}`;
        if (this.scorePercent !== 100) {
            this.connList.innerHTML += `<div class="match_feedback"><strong>Feedback:</strong> ${this.boxData.feedback}</div>`;
        }
        this.queueMathJax(this.connList)
    }

    createStatement(container) {
        const statement = document.createElement('div');
        statement.className = 'statement';
        statement.classList.add('match_question');
        statement.innerHTML = this.boxData.statement;
        container.insertBefore(statement, container.firstChild);
        return statement;
    }


    restoreAnswers(data) {
        // Recreate lines
        if (data) {
            this.connections = data.answer.connections.map(conn => ({
                fromBox: this.allBoxes.find(box => box.dataset.id === conn.from),
                toBox: this.allBoxes.find(box => box.dataset.id === conn.to)
            }));
            this.updateConnectionModel();
            this.correct = data.correct;
        }
        this.connections.forEach(conn => {
            const from = this.getRightBoxCenter(conn.fromBox);
            const to = this.getLeftBoxCenter(conn.toBox);
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
        const data = localStorage.getItem(this.divid);
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
        localStorage.setItem(this.divid, JSON.stringify(data));
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
        gradeBtn.textContent = 'Check Me';
        gradeBtn.classList.add('btn', 'btn-success');
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-button';
        resetBtn.textContent = 'Reset';
        resetBtn.classList.add('btn', 'btn-default');
        // add Help button
        const helpBtn = document.createElement('button');
        helpBtn.className = 'help-button';
        helpBtn.textContent = '?';                     // changed from 'Help'
        helpBtn.setAttribute('aria-label', 'Help');    // accessible label
        controlDiv.appendChild(gradeBtn);
        controlDiv.appendChild(resetBtn);
        controlDiv.appendChild(helpBtn);
        container.appendChild(controlDiv);

        // events
        gradeBtn.addEventListener('click', () => this.gradeConnections());
        resetBtn.addEventListener('click', () => this.resetConnections());
        helpBtn.addEventListener('click', () => this.showHelp());
        this.gradeBtn = gradeBtn;
        this.resetBtn = resetBtn;
        this.helpBtn = helpBtn;
        return controlDiv;
    }

    createHelpModal() {
        this.helpModal = document.createElement('div');
        this.helpModal.className = 'help-modal';
        const text = `<p>Click and drag between boxes to create connections.</p>
        <p>Use the tab key to navigate to a box and press Enter to select the box.  Then tab to the connecting box and press Enter to create a connection between the two selected boxes.</p>
        <p>Click on a connection line to remove it. You can also use the tab key to select lines.  Press the delete key to remove a selected line.</p>
        <p>Click the "Check Me" button to check your connections, and save your work.</p>
        <p>Click the "Reset" button to clear all connections.</p>`

        this.helpModal.innerHTML = `
          <div class="help-modal-content">
            <button class="help-close">&times;</button>
            <div class="help-text">${text}</div>
          </div>`;
        this.containerDiv.appendChild(this.helpModal);
        this.helpModal.querySelector('.help-close')
            .addEventListener('click', () => this.hideHelp());
    }

    showHelp() {
        this.helpModal.style.display = 'flex';
    }

    hideHelp() {
        this.helpModal.style.display = 'none';
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

        const imgs = Array.from(this.workspace.querySelectorAll('img'));
        if (imgs.length === 0) {
            this.boxesRenderedResolve();
        }
        // Wait for all images to load before resolving the promise
        const imgPromises = imgs.map(img => {
            if (typeof img.decode === 'function') {
                return img.decode();
            }
            if (img.complete && img.naturalWidth !== 0) {
                return Promise.resolve();
            }
            return new Promise((resolve) => {
                img.addEventListener('load', () => resolve());
                img.addEventListener('error', () => resolve());
            });
        });

        Promise.all(imgPromises).then(() => {
            this.boxesRenderedResolve();
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

    getRightBoxCenter(el) {
        const elRect = el.getBoundingClientRect();
        const containerRect = this.workspace.getBoundingClientRect();
        return {
            x: elRect.left - containerRect.left + elRect.width,
            y: elRect.top - containerRect.top + elRect.height / 2
        };
    }
    getLeftBoxCenter(el) {
        const elRect = el.getBoundingClientRect();
        const containerRect = this.workspace.getBoundingClientRect();
        return {
            x: elRect.left - containerRect.left,
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
        line.setAttribute("tabindex", "0"); // Make the line focusable
        line.setAttribute("focusable", "true"); // Make the line focusable
        line.setAttribute("role", "button"); // Add ARIA role for accessibility
        line.setAttribute("aria-label", "Connection line. Press Delete to remove."); // Add ARIA label


        line.addEventListener("click", () => {
            this.removeLine(line);
        });

        line.addEventListener("keydown", (e) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                this.removeLine(line);
            }
        });

        return line;
    }

    removeLine(line) {
        this.svg.removeChild(line);
        const index = this.connections.findIndex(conn =>
            (conn.fromBox === line.fromBox && conn.toBox === line.toBox) ||
            (conn.fromBox === line.toBox && conn.toBox === line.fromBox)
        );
        if (index !== -1) this.connections.splice(index, 1);
        this.updateConnectionModel();
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

        // we should always store connections as drag to drop
        // even if the user connects drop to drag
        if (fromBox.dataset.role === "drop") {
            [fromBox, toBox] = [toBox, fromBox];
        }
        if (this.isConnected(fromBox, toBox)) return;

        const from = this.getRightBoxCenter(fromBox);
        const to = this.getLeftBoxCenter(toBox);
        const line = this.createLineElement(from.x, from.y, to.x, to.y);

        line.fromBox = fromBox;
        line.toBox = toBox;

        this.svg.appendChild(line);
        this.connections.push({ fromBox, toBox, line });
        this.updateConnectionModel();
        this.isAnswered = true;

        if (this.ariaLive) {
            this.ariaLive.textContent = `Connected ${fromBox.textContent} to ${toBox.textContent}`;
        }
    }

    updateConnectionModel() {
        this.connList.innerHTML = "<strong>Connections:</strong><br>";
        this.connections.forEach(conn => {
            const fromLabel = conn.fromBox.textContent;
            let toLabel = conn.toBox.textContent;
            if (!toLabel) {
                toLabel = conn.toBox.querySelector("img").alt // innerHTML preserves everything inside <label>…</label>       
            }
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
        this.logCurrentAnswer();
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
            box.addEventListener("pointerdown", e => {
                if (e.ctrlKey || e.metaKey || true) {
                    e.preventDefault();
                    this.startBox = box;
                    const from = this.getRightBoxCenter(this.startBox);
                    this.tempLine = this.createLineElement(from.x, from.y, from.x, from.y);
                    this.tempLine.setAttribute("stroke", "gray");
                    this.tempLine.setAttribute("stroke-dasharray", "4");
                    this.svg.appendChild(this.tempLine);

                    document.addEventListener("pointermove", this.updateTempLine);
                    document.addEventListener("pointerup", this.finishConnection);
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
                const from = this.getRightBoxCenter(conn.fromBox);
                const to = this.getLeftBoxCenter(conn.toBox);
                conn.line.setAttribute("x1", from.x);
                conn.line.setAttribute("y1", from.y);
                conn.line.setAttribute("x2", to.x);
                conn.line.setAttribute("y2", to.y);
            });
        });
    }

    updateTempLine = (e) => {
        e.preventDefault();
        if (!this.startBox || !this.tempLine) return;
        const from = this.getRightBoxCenter(this.startBox);
        this.tempLine.setAttribute("x1", from.x);
        this.tempLine.setAttribute("y1", from.y);
        const containerRect = this.workspace.getBoundingClientRect();
        const x = e.clientX - containerRect.left;
        const y = e.clientY - containerRect.top;

        this.tempLine.setAttribute("x2", x);
        this.tempLine.setAttribute("y2", y);
    };

    finishConnection = (e) => {
        e.preventDefault();
        if (this.tempLine) {
            this.svg.removeChild(this.tempLine);
            this.tempLine = null;
        }

        // the target element is the element under the pointer
        // when the pointer is released
        // this is not the same as e.target which may be the box or it may be the svg 
        // or it may be the line, so we do it this way instead of checking to see if the box contains
        // e.target.  const endBox = this.allBoxes.find(box => box.contains(e.target) && box !== this.startBox);
        const pointX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
        const pointY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
        const targetElement = document.elementFromPoint(pointX, pointY);

        const endBox = this.allBoxes.find(box =>
            box.contains(targetElement) && box !== this.startBox
        );

        if (this.startBox && endBox) this.createPermanentLine(this.startBox, endBox);

        this.startBox = null;
        document.removeEventListener("pointermove", this.updateTempLine);
        document.removeEventListener("pointerup", this.finishConnection);
    }
}




// Register the component with Runestone 
document.addEventListener("runestone:login-complete", () => {
    document.querySelectorAll('[data-component="matching"]').forEach(container => {
        if (!container.closest("[data-component=timedAssessment]")) {
            let opts = { orig: container }
            window.componentMap[container.id] = new MatchingProblem(opts);
        }
    });
});

// Add component factory initialization
if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}

window.component_factory.matching = function (opts) {
    return new MatchingProblem(opts);
};