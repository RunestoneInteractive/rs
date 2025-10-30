/* =====================================================================
==== ParsonsLine Object ================================================
======== The model and view of a line of code.
======== Based on what is specified in the problem.
======== ParsonBlock objects have one or more of these.
==== PROPERTIES ========================================================
======== problem: the Parsons problem
======== index: the index of the line in the problem
======== text: the text of the code line
======== indent: the indent level
======== view: an element for viewing this object
======== distractor: whether it is a distractor
======== paired: whether it is a paired distractor
======== groupWithNext: whether it is grouped with the following line
======== width: the pixel width when rendered
============ in the initial grouping
===================================================================== */
// Initialize from codestring

export default class ParsonsLine {
    constructor(problem, codestring, displaymath) {
        this.problem = problem;
        this.index = problem.lines.length;
        // removes trailing whitespace
        var trimmed = codestring.replace(/\s*$/, "");
        // CodeTailor: Actions are required only if the puzzle well be served as scaffolding puzzle in CodeTailor
        // So here we use problem.options.scaffolding to determine if the puzzle is a scaffolding puzzle
        if (this.problem.options.scaffolding === true) {
            function hasTopLevelClass(lines) {
                return lines.some(({ text }) => text.trimStart().toLowerCase().startsWith("class ")   // now check for “class ” at position 0
                );
            }
            if (this.problem.noindent) {
                this.text = trimmed;
            } else {
                // remove any leading whitespace
                this.text = trimmed.replace(/^\s*/, "");
            }
            
            if (this.problem.options.language == "java") {
                this.text = this.text.replace(/\t/g, "    "); 
                if (this.text.toLowerCase().startsWith("public class")) {
                    this.indent = 0;  // Set indent to 0 for class start
                } else {
                    this.indent = trimmed.length - this.text.length;  // Calculate normal indentation
                }
            } else {
                const allLines = this.problem.lines;
                // put indentation of import line as 0
                if (this.text.toLowerCase().startsWith("import")) {
                    this.indent = 0;  
                }

                // Check if the line is a class definition - if so, then do not set up indentation of def line as 0    
                if (hasTopLevelClass(allLines)) {
                    if (this.text.toLowerCase().startsWith("class")) {
                        this.indent = 0;  // Set indent to 0 for class start
                    } else {
                        this.indent = trimmed.length - this.text.length;  // Calculate normal indentation
                    }
                } else {
                    // Check if the line is a function definition - if so, then set up indentation of def line as 0
                    if (this.text.toLowerCase().startsWith("def")) {
                        this.indent = 0;  // Set indent to 0 for def start
                    } else {
                        this.indent = trimmed.length - this.text.length;  // Calculate normal indentation
                    }
                }
            }
        } else {
            this.text = trimmed.replace(/^\s*/, "");
            this.indent = trimmed.length - this.text.length;
        }
       // Create the View
        var view;
        // TODO: this does not work with display math... Perhaps with pretext we should have html as a language and do nothing?
        
        if (problem.options.language == "natural" || problem.options.language == "math") {
            if (! displaymath) {
                view = document.createElement("p");
            } else {
                view = document.createElement("div");
            }
        } else {
            view = document.createElement("code");
            $(view).addClass(problem.options.prettifyLanguage);
        }
        view.id = problem.counterId + "-line-" + this.index;
        view.innerHTML += this.text;
        this.view = view;
        problem.lines.push(this);
    }
    // Initialize what width the line would naturally have (without indent)
    initializeWidth() {
        // this.width does not appear to be used anywhere later
        // since changing the value of this.width appears to have no effect. - Vincent Qiu (September 2020)
        this.width =
            $(this.view).outerWidth(true) -
            this.problem.options.pixelsPerIndent * this.indent;

        // Pass this information on to be used in class Parsons function initializeAreas
        // to manually determine appropriate widths - Vincent Qiu (September 2020)
        this.view.fontSize = window
            .getComputedStyle(this.view, null)
            .getPropertyValue("font-size");
        this.view.pixelsPerIndent = this.problem.options.pixelsPerIndent;
        this.view.indent = this.indent;

        // Figure out which typeface will be rendered by comparing text widths to browser default - Vincent Qiu (September 2020)
        var tempCanvas = document.createElement("canvas");
        var tempCanvasCtx = tempCanvas.getContext("2d");
        var possibleFonts = window
            .getComputedStyle(this.view, null)
            .getPropertyValue("font-family")
            .split(", ");
        var fillerText = "abcdefghijklmnopqrstuvwxyz0123456789,./!@#$%^&*-+";
        tempCanvasCtx.font = this.view.fontSize + " serif";
        var serifWidth = tempCanvasCtx.measureText(fillerText).width;
        for (let i = 0; i < possibleFonts.length; i++) {
            if (possibleFonts[i].includes('"')) {
                possibleFonts[i] = possibleFonts[i].replaceAll('"', "");
            }
            if (possibleFonts[i].includes("'")) {
                possibleFonts[i] = possibleFonts[i].replaceAll("'", "");
            }
            tempCanvasCtx.font = this.view.fontSize + " " + possibleFonts[i];
            if (tempCanvasCtx.measureText(fillerText).width !== serifWidth) {
                this.view.fontFamily = possibleFonts[i];
                break;
            }
        }
    }
    // Answer the block that this line is currently in
    block() {
        for (let i = 0; i < this.problem.blocks.length; i++) {
            var block = this.problem.blocks[i];
            for (var j = 0; j < block.lines.length; j++) {
                if (block.lines[j] === this) {
                    return block;
                }
            }
        }
        return undefined;
    }
    // Answer the indent based on the view
    viewIndent() {
        if (this.problem.noindent) {
            return this.indent;
        } else {
            var block = this.block();
            return this.indent - block.solutionIndent() + block.indent;
        }
    }
}