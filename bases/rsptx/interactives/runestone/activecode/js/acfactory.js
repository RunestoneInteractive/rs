import { ActiveCode, isInViewport } from "./activecode.js";
import JSActiveCode from "./activecode_js.js";
import HTMLActiveCode from "./activecode_html.js";
import SQLActiveCode from "./activecode_sql.js";
import LiveCode from "./livecode.js";
import {
    TimedActiveCode,
    TimedLiveCode,
    TimedJSActiveCode,
    TimedHTMLActiveCode,
    TimedSQLActiveCode,
} from "./timed_activecode";
import "../../common/js/jquery.highlight.js";

export default class ACFactory {
    constructor() {
        this.foo = "bar";
    }
    static createActiveCode(orig, lang, addopts) {
        var opts = {
            orig: orig,
            useRunestoneServices: eBookConfig.useRunestoneServices,
            python3: eBookConfig.python3,
        };
        if (addopts) {
            for (var attrname in addopts) {
                opts[attrname] = addopts[attrname];
            }
        }
        if (lang === undefined) {
            let dataElem = opts.orig.querySelector("[data-lang]");
            lang = dataElem ? dataElem.dataset.lang : undefined;
        }
        if (opts.timed == true) {
            if (lang === "python") {
                return new TimedActiveCode(opts);
            } else if (
                lang === "java" ||
                lang === "cpp" ||
                lang === "c" ||
                lang === "python3"
            ) {
                return new TimedLiveCode(opts);
            } else if (lang === "javascript") {
                return new TimedJSActiveCode(opts);
            } else if (lang === "htmlmixed") {
                return new TimedHTMLActiveCode(opts);
            } else if (lang === "sql") {
                return new TimedSQLActiveCode(opts);
            } else {
                return new TimedActiveCode(opts);
            }
        } else {
            if (lang === "javascript") {
                return new JSActiveCode(opts);
            } else if (lang === "htmlmixed") {
                return new HTMLActiveCode(opts);
            } else if (lang === "sql") {
                return new SQLActiveCode(opts);
            } else if (
                ["java", "cpp", "c", "python3", "python2", "octave", "kotlin"].indexOf(
                    lang
                ) > -1
            ) {
                return new LiveCode(opts);
            } else {
                // default is python
                return new ActiveCode(opts);
            }
        }
    }
    // used by web2py controller(s)
    static addActiveCodeToDiv(outerdivid, acdivid, sid, initialcode, language) {
        var acdiv = document.getElementById(acdivid);
        acdiv.innerHTML = "";
        var thepre = document.createElement("textarea");
        thepre["data-component"] = "activecode";
        thepre.id = outerdivid;
        thepre.dataset.lang = language;
        acdiv.appendChild(thepre);
        var opts = {
            orig: thepre,
            useRunestoneServices: true,
        };
        var addopts = {
            sid: sid,
            graderactive: true,
        };
        var newac = ACFactory.createActiveCode(thepre, language, addopts);
        var savediv = newac.divid;
        newac.divid = savediv;
        newac.editor.setSize(500, 300);
        setTimeout(function () {
            newac.editor.refresh();
        }, 500);
    }
    static createActiveCodeFromOpts(opts) {
        return ACFactory.createActiveCode(opts.orig, opts.lang, opts);
    }
    static createScratchActivecode() {
        /* set up the scratch Activecode editor in the search menu */
        // use the URL to assign a divid - each page should have a unique Activecode block id.
        // Remove everything from the URL but the course and page name
        // todo:  this could probably be eliminated and simply moved to the template file

        if (eBookConfig.enableScratchAC == false) return;

        var divid = eBookConfig.course + "_scratch_ac";
        divid = divid.replace(/[#.]/g, ""); // in case book title has characters that will mess up our selectors
        eBookConfig.scratchDiv = divid;
        let stdin = "";
        var lang = eBookConfig.acDefaultLanguage
            ? eBookConfig.acDefaultLanguage
            : "python";
        if (lang === "java" || lang === "cpp" || lang === "python3") {
            stdin = `data-stdin="text for stdin"`;
        }
        const languageNames = {
            cpp: "C++",
            c: "C",
            html: "HTML",
            htmlmixed: "HTML",
            java: "Java",
            javascript: "JavaScript",
            js: "JavaScript",
            kotlin: "Kotlin",
            octave: "Octave",
            python: "Python",
            py2: "Python 2",
            python2: "Python 2",
            py3: "Python 3",
            py3anaconda: "Python 3 with Anaconda",
            python3: "Python 3",
            ruby: "Ruby",
            sql: "SQL",
            ts: "TypeScript",
        };

        // generate the HTML
        var html = `<div class="ptx-runestone-container">
            <div id="ac_modal_${divid}" class="scratch-ac-modal">
                <div class="ac-modal-content">
                  <div class="ac-modal-header">
                    <button type="button" class="close first-focusable" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 class="ac-modal-title">Scratch ActiveCode (${languageNames[lang.toLowerCase()] || lang
            })</h4>
                  </div>
                  <div class="ac-modal-body">
                  <div data-component="activecode" id=${divid}>
                  <div id=${divid}_question class="ac_question"><p>Use this area for writing code or taking notes.</p></div>
                  <textarea data-codelens="true" data-lang="${lang}" ${stdin} aria-label="Scratch ActiveCode">
                  </textarea>
                  </div>
                  </div>
                </div>
            </div>
            </div>`;
        var el = document.createElement("div");
        el.innerHTML = html;
        document.body.appendChild(el);
        let observable = document.getElementById("ac_modal_" + divid);
        // when the modal becomes visible we want to refresh the CodeMirror editor to ensure
        // that it is properly displayed.
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
                    if (isInViewport(observable)) {
                        observable.querySelectorAll(".CodeMirror").forEach(function (e) {
                            e.CodeMirror.refresh();
                        });
                    }
                }
            });
        });

        // Start observing the element for style changes
        observer.observe(observable, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        //todo intercept the close event and return focus to the pencil icon
        let closeBtn = document.querySelector(".ac-modal-header button.close");
        closeBtn.addEventListener("click", function () {
            let popUp = document.getElementById("ac_modal_" + divid);
            popUp.style.display = "none";
            document.querySelector(".activecode-toggle").focus();
        });
    }

    // Note: this function is called from popScratchAC in webpack.index.js
    // this happens after activecode.js is dynamically loaded.
    static toggleScratchActivecode() {
        if (!eBookConfig.enableScratchAC) return;
        var divid = "ac_modal_" + eBookConfig.scratchDiv;
        var realDiv = document.getElementById(divid);
        realDiv.classList.remove("ac_section");
        realDiv.style.display = (realDiv.style.display === "none" || realDiv.style.display === "") ? "block" : "none";

        const selectors = '.first-focusable, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        let firstFocusableElement = realDiv.querySelector(selectors);
        let focusableElements = realDiv.querySelectorAll(selectors);
        let lastFocusableElement =
            focusableElements[focusableElements.length - 1];

        realDiv.addEventListener("keydown", (event) => {
            if (event.key === "Tab") {
                firstFocusableElement = realDiv.querySelector(selectors);
                focusableElements = realDiv.querySelectorAll(selectors);
                lastFocusableElement =
                    focusableElements[focusableElements.length - 1];
                if (event.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstFocusableElement) {
                        event.preventDefault();
                        lastFocusableElement.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastFocusableElement) {
                        event.preventDefault();
                        firstFocusableElement.focus();
                    }
                }
            } else {
                if (event.key === "Escape") {
                    realDiv.style.display = "none";
                    document.querySelector(".activecode-toggle").focus();
                }
            }
        });



        if (firstFocusableElement) {
            console.log(`focus on ${firstFocusableElement}`);
            firstFocusableElement.focus();
        }
    }
}

//
// Page Initialization
//

document.addEventListener("runestone:login-complete", function () {
    ACFactory.createScratchActivecode();
    document.querySelectorAll("[data-component='activecode']").forEach(function (element) {
        if (element.closest("[data-component='timedAssessment']") === null) {
            try {
                let textArea = element.querySelector("textarea");
                window.componentMap[element.id] = ACFactory.createActiveCode(element, textArea ? textArea.dataset.lang : null);
            } catch (err) {
                console.error(`Error rendering Activecode Problem ${element.id}
                Details: ${err}`);
                console.error(err.stack);
            }
        }
    });
    if (loggedout) {
        for (let k in window.componentMap) {
            if (window.componentMap[k].disableSaveLoad) {
                window.componentMap[k].disableSaveLoad();
            }
        }
    } else {
        for (let k in window.componentMap) {
            if (window.componentMap[k].enableSaveLoad) {
                window.componentMap[k].enableSaveLoad();
            }
        }
    }
});

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}

window.component_factory.activecode = ACFactory.createActiveCodeFromOpts;

// This is the easiest way to expose this outside the module.
window.ACFactory = ACFactory;

// This seems a bit hacky and possibly brittle, but its hard to know how long it will take to
// figure out the login/logout status of the user.  Sometimes its immediate, and sometimes its
// long.  So to be safe we'll do it both ways..
var loggedout;
document.addEventListener("runestone:logout", function () {
    loggedout = true;
});
document.addEventListener("runestone:logout", function () {
    for (let k in window.componentMap) {
        if (
            window.componentMap.hasOwnProperty(k) &&
            window.componentMap[k].attributes["data-component"] == "activecode"
        ) {
            window.componentMap[k].disableSaveLoad();
        }
    }
});
