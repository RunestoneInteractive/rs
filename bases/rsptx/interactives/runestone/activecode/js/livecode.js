import { ActiveCode } from "./activecode.js";
import MD5 from "./md5.js";
import JUnitTestParser from "./extractUnitResults-JUnit.js";
import DoctestTestParser from "./extractUnitResults-Doctest.js";
import "../../codelens/js/pytutor-embed.bundle.js";
import { base64encode } from "byte-base64";

export default class LiveCode extends ActiveCode {
    constructor(opts) {
        var orig = $(opts.orig).find("textarea")[0];
        super(opts);
        this.stdin = $(orig).data("stdin");
        this.datafile = $(orig).data("datafile");
        this.sourcefile = $(orig).data("sourcefile");
        this.compileargs = unescapeHtml($(orig).data("compileargs"));
        this.linkargs = unescapeHtml($(orig).data("linkargs"));
        this.runargs = unescapeHtml($(orig).data("runargs"));
        this.interpreterargs = unescapeHtml($(orig).data("interpreterargs"));
        this.API_KEY = "67033pV7eUUvqo07OJDIV8UZ049aLEK1";
        this.USE_API_KEY = true;
        this.JOBE_SERVER = eBookConfig.jobehost || eBookConfig.host;
        this.resource = eBookConfig.proxyuri_runs || "/ns/rsproxy/jobeRun";
        this.jobePutFiles =
            eBookConfig.proxyuri_files || "/ns/rsproxy/jobePushFile/";
        this.jobeCheckFiles =
            eBookConfig.proxyuri_files || "/ns/rsproxy/jobeCheckFile/";
        // TODO:  should add a proper put/check in pavement.tmpl as this is misleading and will break on runestone
        this.div2id = {};
        if (typeof this.stdin !== "undefined") {
            this.createInputElement();
        }
        this.createErrorOutput();
    }
    outputfun(a) { }
    createInputElement() {
        let inputContainer = document.createElement("div");
        var label = document.createElement("label");
        label.for = this.divid + "_stdin";
        $(label).text($.i18n("msg_activecode_input_prg"));
        var input = document.createElement("textarea");
        input.id = this.divid + "_stdin";
        input.classList.add("activecode__stdin");
        input.value = this.stdin;
        input.setAttribute("rows", "3");
        this.outerDiv.appendChild(inputContainer);
        inputContainer.appendChild(label);
        inputContainer.appendChild(input);
        this.stdin_el = input;
    }
    createErrorOutput() { }

    hasUnitTests() {
        return this.language === "java" && this.suffix && this.suffix.indexOf("import org.junit") > -1
        || this.language === "cpp" && this.suffix && this.suffix.indexOf("[doctest]") > -1;
    }

    /*  Main runProg method for livecode
     *
     */
    async runProg(noUI, logResults) {
        if (typeof logResults === "undefined") {
            this.logResults = true;
        } else {
            this.logResults = logResults;
        }
        if (typeof noUI !== "boolean") {
            noUI = false;
        }
        await this.runSetup();
        try {
            // Either have one run or are doing a series of io tests
            if (!this.iotests) {
                let res = await this.submitToJobe();
                if (!res.ok) {
                    this.addJobeErrorMessage(
                        $.i18n(`Server Error: ${res.statusText}`)
                    );
                    $(this.runButton).removeAttr("disabled");
                    return "fail";
                }
                let runResults = await res.json();
                this.processJobeResponse(runResults);
            } else {
                if(this.hasUnitTests()) {
                    console.log(`IO tests are not supported with unit tests. They will be ignored in ${this.divid}`);
                } else {
                    let ioResults = [];
                    for(let iotest of this.iotests) {
                        let spec = JSON.parse(this.json_runspec);
                        spec.run_spec.input = iotest.input;
                        this.json_runspec = JSON.stringify(spec);
                        let iores = await this.submitToJobe();
                        if (!iores.ok) {
                            this.addJobeErrorMessage(
                                $.i18n(`Server Error: ${iores.statusText}`)
                            );
                            $(this.runButton).removeAttr("disabled");
                            return "fail";
                        }
                        let result = await iores.json();
                        result.test = iotest;
                        ioResults.push(result);
                    }
                    this.processJobeIOResponses(ioResults);
                }
            }
        } catch (e) {
            this.addJobeErrorMessage(
                $.i18n("msg_activecode_server_comm_err") + e.toString()
            );
            $(this.runButton).removeAttr("disabled");
            return `fail: ${e}`;
        }
        return "success";
    }
    /**
     * Note:
     * In order to check for supplemental files in java and deal with asynchronicity
     * I split the original runProg into two functions: runProg and runProg_callback
     */
    async runSetup() {
        var stdin;
        var source;
        var saveCode = "True";
        var sfilemap = {
            java: "",
            cpp: "test.cpp",
            c: "test.c",
            python3: "test.py",
            python2: "test.py",
            octave: "octatest.m",
        };
        var sourcefilename = "";
        var testdrivername = "";
        var file_checkp;

        // extract the class names so files can be named properly
        if (this.suffix && this.language == "java") {
            // the suffix contains unit test code and should include and import of junit
            // import static org.junit.Assert.*;
            // import org.junit.*;
            // import java.io.*;
            if (this.suffix.indexOf("import org.junit") < 0) {
                console.log(`Missing imports in unit tests:
                    ${this.suffix}`);
                // alert("The unit tests for this problem are incomplete, Please report this.");
                this.suffix =
                    `
                import static org.junit.Assert.*;
                import org.junit.*;
                import java.io.*;
                ` + this.suffix;
            }
            let classMatch = new RegExp(/public\s+class\s+(\w+)/);
            source = await this.buildProg(false);
            let m = source.match(classMatch);
            if (m) {
                sourcefilename = m[1] + ".java";
            } else {
                alert(
                    "Error: Could not find the class name in the source, this will not compile."
                );
                throw new Error("No class name in source");
            }
            // this will be unit test code
            m = this.suffix.match(classMatch);
            if (m) {
                testdrivername = m[1] + ".java";
            }
        } else {
            source = await this.buildProg(true);
        }
        // Validate the data is convertible to Base64. If not then error out now
        try {
            btoa(source);
        } catch (e) {
            alert(
                "Error: Bad Characters in the activecode window. Likely a quote character that has been copy/pasted. 🙁"
            );
            return;
        }

        this.saveCode = await this.manage_scrubber(saveCode);

        // assemble parameters for JOBE
        var paramlist = [
            "compileargs",
            "linkargs",
            "runargs",
            "interpreterargs",
            "memorylimit",
        ];
        var paramobj = {};
        for (let param of paramlist) {
            if (this[param]) {
                paramobj[param] = eval(this[param]); // needs a list
            }
        }
        if (this.language === "octave") {
            paramobj.memorylimit = 200000;
        }
        if (this.timelimit) {
            // convert to seconds to match JOBE - decimal is OK
            let timelimitSeconds = this.timelimit / 1000;
            paramobj.cputime = timelimitSeconds;
        }

        if (this.stdin) {
            stdin = $(this.stdin_el).val();
        }
        if (!this.sourcefile) {
            this.sourcefile = sfilemap[this.language];
        }

        $(this.output).html($.i18n("msg_activecode_compiling_running"));
        var files = [];
        var content, base64;
        if (this.datafile != undefined) {
            var ids = this.datafile.split(",");
            for (var i = 0; i < ids.length; i++) {
                let fileName = ids[i].trim();
                let file = document.getElementById(fileName);
                if (file === null || file === undefined) {
                    file = document.querySelector(
                        '[data-filename="' + fileName + '"]'
                    );
                }
                let fileExtension = fileName.substring(
                    fileName.lastIndexOf(".") + 1
                );
                if (file === null || file === undefined) {
                    // console.log("No file with given id");
                    // check to see if file is in db
                    content = this.fileReader(fileName);
                } else {
                    // if file element is editable textarea, file.value is defined and has the current contents
                    // otherwise rely on static contents
                    if(file.value)
                        content = file.value;
                    else
                        content = file.textContent;
                    // may be undefined at this point if file is an image
                }
                if (fileExtension === "jar") {
                    files = files.concat(this.parseJavaClasses(content));
                } else if (["jpg", "png", "gif"].indexOf(fileExtension) > -1) {
                    if (file) {
                        if (file.toDataURL) {
                            base64 = file.toDataURL("image/" + fileExtension);
                            base64 = base64.substring(base64.indexOf(",") + 1);
                        } else {
                            base64 = file.src.substring(
                                file.src.indexOf(",") + 1
                            );
                        }
                    } else {
                        base64 = content;
                    }
                    files.push({ name: fileName, content: base64 });
                } else {
                    // if no className or un recognized className it is treated as an individual file
                    // this could be any type of file, .txt, .java, .csv, etc
                    files.push({ name: fileName, content: content });
                }
            }
        }
        // If we are running unit tests we need to substitute the test driver for the student
        // code and send the student code as a file.  We'll do that here.
        this.junitDriverCode = `
        import org.junit.runner.JUnitCore;
        import org.junit.runner.Result;
        import org.junit.runner.notification.Failure;

        public class TestRunner {
            public static void main(String[] args) {
                CodeTestHelper.resetFinalResults();
                Result result = JUnitCore.runClasses(${testdrivername.replace(
            ".java",
            ".class"
        )});
                System.out.println(CodeTestHelper.getFinalResults());

                int total = result.getRunCount();
                int fails = result.getFailureCount();
                int corr  = total - fails;
                System.out.println("You got " + corr + " out of " + total + " correct. " + String.format("%.2f", (100.0 * corr / total)) + "%");
            }
        }
        `;
        if (this.suffix && this.language == "java") {
            files.push({ name: sourcefilename, content: source });
            files.push({ name: testdrivername, content: this.suffix });
            source = this.junitDriverCode;
            if (paramobj.compileargs) {
                paramobj.compileargs.push(sourcefilename);
            } else {
                paramobj.compileargs = [sourcefilename];
            }
        }
        let runspec = {
            language_id: this.language,
            sourcecode: source,
            parameters: paramobj,
            sourcefilename: this.sourcefile,
        };

        if (stdin) {
            runspec.input = stdin;
        }
        if (files.length === 0) {
            this.json_runspec = JSON.stringify({ run_spec: runspec });
            file_checkp = Promise.resolve("ready");
        } else {
            runspec["file_list"] = [];
            var promises = [];
            var instance = this;

            for (let i = 0; i < files.length; i++) {
                var fileName = files[i].name;
                var fileContent = files[i].content;
                instance.div2id[fileName] =
                    "runestone" + MD5(fileName + fileContent);
                runspec["file_list"].push([
                    instance.div2id[fileName],
                    fileName,
                ]);
                promises.push(
                    new Promise((resolve, reject) => {
                        instance.checkFile(files[i], resolve, reject);
                    })
                );
            }
            this.json_runspec = JSON.stringify({ run_spec: runspec });
            this.div2id = instance.div2id;
            file_checkp = Promise.all(promises).catch(function (err) {
                console.log("Error: " + err);
            });
        }
        return file_checkp;
    }

    /* Submit the assembled job to the JOBE server and await the results.
     *
     */
    async submitToJobe() {
        var data = this.json_runspec;
        let host = this.JOBE_SERVER + this.resource;
        $(this.runButton).attr("disabled", "disabled");
        $(this.outDiv).show({ duration: 700, queue: false });
        $(this.errDiv).remove();
        $(this.output).css("visibility", "visible");

        let headers = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
            "X-API-KEY": this.API_KEY,
        });
        let request = new Request(host, {
            method: "POST",
            headers: headers,
            body: data,
        });
        return fetch(request);

        ///$("#" + divid + "_errinfo").remove();
    }

    // Handle the results of a single program run (including formal unit tests)
    processJobeResponse(result) {
        var logresult;
        var odiv = this.output;
        this.parsedOutput = {};
        $(this.runButton).removeAttr("disabled");
        if (result.outcome === 15) {
            logresult = "success";
        } else {
            logresult = result.outcome;
        }
        this.errinfo = logresult;
        switch (result.outcome) {
            case 15: {
                if (this.language === "java") {
                    this.parsedOutput = new JUnitTestParser(
                        result.stdout,
                        this.divid
                    );
                    $(odiv).html(this.parsedOutput.stdout);
                } else if (this.language === "cpp" && result.stdout.includes("[doctest]")) {
                    this.parsedOutput = new DoctestTestParser(
                        result.stdout,
                        this.divid
                    );
                    $(odiv).html(this.parsedOutput.stdout);
                } else {
                    let output = result.stdout ? result.stdout : "";
                    $(odiv).html(output);
                }
                if (this.suffix) {
                    if (this.parsedOutput.pct === undefined) {
                        this.parsedOutput.pct =
                            this.parsedOutput.passed =
                            this.parsedOutput.failed =
                            0;
                    }
                    this.unit_results = `percent:${this.parsedOutput.pct}:passed:${this.parsedOutput.passed}:failed:${this.parsedOutput.failed}`;
                }
                break;
            }
            case 11: // compiler error
                $(odiv).html($.i18n("msg_activecode_were_compiling_err"));
                this.addJobeErrorMessage(result.cmpinfo);
                this.errinfo = result.cmpinfo;
                break;
            case 12: // run time error
                $(odiv).html(result.stdout.replace(/\n/g, "<br>"));
                if (result.stderr) {
                    this.addJobeErrorMessage(result.stderr);
                }
                break;
            case 13: // time limit
                $(odiv).html(escapeHtml(result.stdout).replace(/\n/g, "<br>"));
                this.addJobeErrorMessage(
                    $.i18n("msg_activecode_time_limit_exc")
                );
                break;
            default:
                if (result.stderr) {
                    $(odiv).html(result.stderr.replace(/\n/g, "<br>"));
                } else {
                    this.addJobeErrorMessage(
                        $.i18n("msg_activecode_server_err")
                    );
                }
        }
        // todo: handle server busy errors too
    }

    // Handle the results of a seriest of program runs from IO tests
    processJobeIOResponses(resultList) {
        //process a series of IO test results into one unittest-like result

        $(this.output).html($.i18n("msg_activecode_iotest_results"));
        $(this.runButton).removeAttr("disabled");
        const odiv = this.output;
        this.parsedOutput = {};

        // Make a pretty results table
        const parent = document.createElement("div");
        const heading = document.createElement("div");
        heading.classList.add("unittest-results__heading");
        heading.innerHTML = $.i18n("msg_activecode_unit_test_results");
        parent.appendChild(heading);
        parent.classList.add("unittest-results");
        const tbl = document.createElement("table");
        tbl.classList.add("ac-feedback");
        parent.appendChild(tbl);
        parent.setAttribute("id", `${this.divid}_unit_results`);
        const trh = document.createElement("tr");
        trh.innerHTML =
            '<th class="ac-feedback">Input:</th><th class="ac-feedback">Expected Output:</th><th class="ac-feedback">Your Output:</th><th class="ac-feedback">Result:</th>';
        tbl.appendChild(trh);
        this.parsedOutput.table = parent;

        // Process each IO test result
        let passedTests = 0;
        // we will stop on the first error
        this.errinfo = null;
        for (let result of resultList) {
            const produced = result.stdout.trim();
            const desired = result.test.out.trim();
            const tr = document.createElement("tr");
            const td1 = document.createElement("td");
            td1.classList.add("ac-feedback");
            td1.innerHTML = result.test.input.replace(/\n/g, "<br>");
            tr.appendChild(td1);
            const td2 = document.createElement("td");
            td2.classList.add("ac-feedback");
            td2.innerHTML = desired.replace(/\n/g, "<br>");
            tr.appendChild(td2);
            const td3 = document.createElement("td");
            td3.classList.add("ac-feedback");
            td3.innerHTML = produced.replace(/\n/g, "<br>");
            tr.appendChild(td3);
            const td4 = document.createElement("td");
            td4.classList.add("ac-feedback");
            tr.appendChild(td4);
            tbl.appendChild(tr);
            switch (result.outcome) {
                case 15:
                    if(produced === desired) {
                        passedTests++;
                        td4.innerHTML = $.i18n("msg_activecode_passed");
                        td4.classList.add("ac-feedback-pass");
                    } else {
                        td4.innerHTML = $.i18n("msg_activecode_failed");
                        td4.classList.add("ac-feedback-fail");
                    }
                    break;
                case 11: // compiler error
                    $(odiv).html(result.cmpinfo.replace(/\n/g, "<br>"));
                    td4.innerHTML = $.i18n("msg_activecode_test_compile_error");
                    td4.classList.add("ac-feedback-fail");
                    this.errinfo = result.cmpinfo;
                    break;
                case 12: // run time error
                    $(odiv).html(result.stderr.replace(/\n/g, "<br>"));
                    td4.innerHTML = $.i18n("msg_activecode_test_run_error");
                    td4.classList.add("ac-feedback-fail");
                    this.errinfo = result.stderr;
                    break;
                case 13: // time limit
                    $(odiv).html(escapeHtml(result.stdout).replace(/\n/g, "<br>"));
                    td4.innerHTML = $.i18n("msg_activecode_time_limit_exc");
                    td4.classList.add("ac-feedback-fail");
                    this.errinfo = 'time exceeded ' + result.stdout;
                    break;
                default:
                    if (result.stderr) {
                        $(odiv).html(result.stderr.replace(/\n/g, "<br>"));
                    }
                    td4.innerHTML = $.i18n("msg_activecode_server_err");
                    td4.classList.add("ac-feedback-fail");
                    this.errinfo = result.stderr;
            }
            if (this.errinfo) {
                break;
            }
        }

        const pct = (passedTests / resultList.length) * 100;
        this.unit_results = `percent:${pct}:passed:${passedTests}:failed:${resultList.length - passedTests}`;
        const pctString = document.createElement("div");
        pctString.classList.add("unittest-results__percent");
        pctString.innerHTML = `${Math.round(pct)}% ` + $.i18n("msg_activecode_passed");
        this.parsedOutput.pctString = pctString;

        if (!this.errinfo) {
            this.errinfo = "success";
        }
    }

    renderFeedback() {
        let rdiv = document.getElementById(`${this.divid}_unit_results`);
        if (rdiv) {
            rdiv.remove();
        }
        if (this.parsedOutput && this.parsedOutput.table) {
            this.outDiv.parentNode.appendChild(this.parsedOutput.table);
        }
        rdiv = document.getElementById(`${this.divid}_unit_results`);
        if (rdiv) {
            rdiv.appendChild(this.parsedOutput.pctString);
        }
    }

    addJobeErrorMessage(err) {
        if (this.errDiv) {
            this.errDiv.remove();
        }
        var errHead = $("<h3>").html("Error");
        var eContainer = this.outerDiv.appendChild(
            document.createElement("div")
        );
        this.errDiv = eContainer;
        eContainer.className = "error alert alert-danger";
        eContainer.id = this.divid + "_errinfo";
        eContainer.appendChild(errHead[0]);
        var errText = eContainer.appendChild(document.createElement("pre"));
        errText.innerHTML = escapeHtml(err);
    }
    /**
     * Checks to see if file is on server
     * Places it on server if it is not on server
     * @param  {object{name, contents}} file    File to place on server
     * @param  {function} resolve promise resolve function
     * @param  {function} reject  promise reject function
     */
    checkFile(file, resolve, reject) {
        var file_id = this.div2id[file.name];
        var resource = this.jobeCheckFiles + file_id;
        var host = this.JOBE_SERVER + resource;
        var xhr = new XMLHttpRequest();
        xhr.open("HEAD", host, true);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.setRequestHeader("Accept", "text/plain");
        xhr.setRequestHeader("X-API-KEY", this.API_KEY);
        xhr.onerror = function () {
            // console.log("error sending file" + xhr.responseText);
        };
        xhr.onload = function () {
            switch (xhr.status) {
                case 208:
                case 404:
                    // console.log("File not on Server");
                    this.pushDataFile(file, resolve, reject);
                    break;
                case 400:
                    // console.log("Bad Request");
                    reject();
                    break;
                case 204:
                    // console.log("File already on Server");
                    resolve();
                    break;
                default:
                    //console.log("This case should never happen");
                    reject();
            }
        }.bind(this);
        xhr.send();
    }
    /**
     * Places a file on a server
     */
    pushDataFile(file, resolve, reject) {
        var fileName = file.name;
        var extension = fileName.substring(fileName.indexOf(".") + 1);
        var file_id = this.div2id[fileName];
        var contents = file.content;
        // File types being uploaded that come in already in base64 format
        var extensions = ["jar", "zip", "png", "jpg", "jpeg"];
        var contentsb64;
        if (extensions.indexOf(extension) === -1) {
            contentsb64 = base64encode(contents);
        } else {
            contentsb64 = contents;
        }
        var data = JSON.stringify({ file_contents: contentsb64 });
        var resource = this.jobePutFiles + file_id;
        var host = this.JOBE_SERVER + resource;
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", host, true);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.setRequestHeader("Accept", "text/plain");
        xhr.setRequestHeader("X-API-KEY", this.API_KEY);
        xhr.onload = function () {
            switch (xhr.status) {
                case 403:
                    // console.log("Forbidden");
                    reject();
                    break;
                case 400:
                    // console.log("Bad Request");
                    reject();
                    break;
                case 204:
                    //console.log("successfully sent file " + xhr.responseText);
                    //console.log("File " + fileName +", " + file_id +" placed on server");
                    resolve();
                    break;
                default:
                    // console.log("This case should never happen");
                    reject();
            }
        }.bind(this);
        xhr.onerror = function () {
            // console.log("error sending file" + xhr.responseText);
            reject();
        };
        xhr.send(data);
    }

    async showCodelens() {
        let clMess = "";
        if (this.codelens.style.display == "none") {
            this.codelens.style.display = "block";
            clMess = "Building your visualization";
            this.codelens.innerHTML = clMess;
            this.clButton.innerText = $.i18n("msg_activecode_hide_codelens");
        } else {
            this.codelens.style.display = "none";
            this.clButton.innerText = $.i18n("msg_activecode_show_in_codelens");
            return;
        }
        var cl = this.codelens.firstChild;
        if (cl) {
            this.codelens.removeChild(cl);
            this.codelens.innerHTML = clMess;
        }
        var code = await this.buildProg(false);
        if (code.match(/System.exit/)) {
            alert(
                "Sorry... System.exit breaks the visualizer temporarily removing"
            );
            code = code.replace(/System.exit\(\d+\);/, "");
        }
        var myVars = {};
        myVars.code = code;
        myVars.lang = this.language;
        if (this.stdin) {
            myVars.stdin = $(this.stdin_el).val();
        }
        var targetDiv = this.codelens.id;

        let request = new Request("/ns/rsproxy/pytutor_trace", {
            method: "POST",
            body: JSON.stringify(myVars),
            headers: this.jsonHeaders,
        });
        try {
            let response = await fetch(request);
            let data = await response.json();
            let vis = addVisualizerToPage(data, targetDiv, {
                startingInstruction: 0,
                editCodeBaseURL: null,
                hideCode: false,
                lang: myVars.lang,
            });
        } catch (error) {
            let targetDivError = document.getElementById(targetDiv);
            targetDivError.innerHTML =
                "Sorry, an error occurred while creating your visualization.";
            console.log("Get Trace Failed -- ");
            console.log(error);
        }

        this.logBookEvent({
            event: "codelens",
            act: "view",
            div_id: this.divid,
        });
    }

    /**
     * Seperates text into multiple .java files
     * @param  {String} text String with muliple java classes needed to be seperated
     * @return {array of objects}  .name gives the name of the java file with .java extension
     *                   .content gives the contents of the file
     */
    parseJavaClasses(text) {
        text = text.trim();
        var found = false;
        var stack = 0;
        var startIndex = 0;
        var classes = [];
        var importIndex = 0;
        var endOfLastCommentBeforeClassBegins = 0;
        for (var i = 0; i < text.length; i++) {
            var char = text.charAt(i);
            if (char === "/") {
                i++;
                if (text.charAt(i) === "/") {
                    i++;
                    while (text.charAt(i) !== "\n" && i < text.length) {
                        i++;
                    }
                    if (!found) {
                        endOfLastCommentBeforeClassBegins = i;
                    }
                } else if (text.charAt(i) == "*") {
                    i++;
                    while (
                        (text.charAt(i) !== "*" ||
                            text.charAt(i + 1) !== "/") &&
                        i + 1 < text.length
                    ) {
                        i++;
                    }
                    if (!found) {
                        endOfLastCommentBeforeClassBegins = i;
                    }
                }
            } else if (char === '"') {
                i++;
                while (text.charAt(i) !== '"' && i < text.length) {
                    i++;
                }
            } else if (char === "'") {
                while (text.charAt(i) !== "'" && i < text.length) {
                    i++;
                }
            } else if (char === "(") {
                var pCount = 1;
                i++;
                while (pCount > 0 && i < text.length) {
                    if (text.charAt(i) === "(") {
                        pCount++;
                    } else if (text.charAt(i) === ")") {
                        pCount--;
                    }
                    i++;
                }
            }
            if (!found && text.charAt(i) === "{") {
                startIndex = i;
                found = true;
                stack = 1;
            } else if (found) {
                if (text.charAt(i) === "{") {
                    stack++;
                }
                if (text.charAt(i) === "}") {
                    stack--;
                }
            }
            if (found && stack === 0) {
                let endIndex = i + 1;
                var words = text
                    .substring(endOfLastCommentBeforeClassBegins, startIndex)
                    .trim()
                    .split(" ");
                var className = "";
                for (var w = 0; w < words.length; w++) {
                    className = words[w];
                    if (words[w] === "extends" || words[w] === "implements") {
                        className = words[w - 1];
                        w = words.length;
                    }
                }
                className = className.trim() + ".java";
                classes.push({
                    name: className,
                    content: text.substring(importIndex, endIndex),
                });
                found = false;
                importIndex = endIndex;
                endOfLastCommentBeforeClassBegins = endIndex;
            }
        }
        return classes;
    }
}
function unescapeHtml(safe) {
    if (safe) {
        return safe
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'");
    }
}
function escapeHtml(str) {
    if (str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#x27;')
            .replace(/"/g, '&quot;');
    }
}
