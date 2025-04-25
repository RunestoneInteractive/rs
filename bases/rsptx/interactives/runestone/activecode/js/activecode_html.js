import { ActiveCode } from "./activecode.js";

export default class HTMLActiveCode extends ActiveCode {
    constructor(opts) {
        super(opts);
        this.code = $("<textarea />").html(this.origElem.innerHTML).text();
        $(this.runButton).text("Render");
        this.editor.setValue(this.code);
    }

    async runProg() {
        var prog = await this.buildProg(true);
        let saveCode = "True";
        this.saveCode = await this.manage_scrubber(saveCode);
        $(this.output).text("");
        this.outDiv.style.visibility = "visible";
        prog =
            "<script type=text/javascript>window.onerror = function(msg,url,line) {alert(msg+' on line: '+line);};</script>" +
            prog;
        this.output.srcdoc = prog;
    }

    createOutput() {
        var outDiv = document.createElement("div");
        $(outDiv).addClass("ac_output");
        this.outDiv = outDiv;
        this.output = document.createElement("iframe");
        $(this.output).css("background-color", "white");
        $(this.output).css("position", "relative");
        $(this.output).css("height", "400px");
        $(this.output).css("width", "100%");
        outDiv.appendChild(this.output);
        this.outerDiv.appendChild(outDiv);
        var clearDiv = document.createElement("div");
        $(clearDiv).css("clear", "both"); // needed to make parent div resize properly
        this.outerDiv.appendChild(clearDiv);
    }
    enableSaveLoad() {
        $(this.runButton).text($.i18n("msg_activecode_render"));
    }
}
