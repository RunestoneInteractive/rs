/*
    Support functions for PreTeXt books running on Runestone

*/

import RunestoneBase from "./runestonebase.js";

function setupPTXEvents() {
    let rb = new RunestoneBase();
    // log an event when a knowl is opened.
    document.querySelectorAll("[data-knowl]").forEach((el) => {
        el.addEventListener("click", function () {
            let div_id = el.getAttribute("data-knowl");
            rb.logBookEvent({ event: "knowl", act: "click", div_id: div_id });
        });
    });
    let born_hidden = document.querySelectorAll("details.born-hidden-knowl");
    born_hidden.forEach((el) => {
        // log an event when a knowl is opened that was born hidden
        el.addEventListener("toggle", function () {
            if (el.open) {
                let div_id = el.id;
                rb.logBookEvent({ event: "knowl", act: "open", div_id: div_id });
            }
        });
    });
    // log an event when a sage cell is evaluated
    document.querySelectorAll(".sagecell_evalButton").forEach((btn) => {
        btn.addEventListener("click", function () {
            let container = btn.closest(".sagecell-sage");
            let codeInput = container ? container.querySelector(".sagecell_input") : null;
            let code = codeInput ? codeInput.textContent : "";
            rb.logBookEvent({ event: "sage", act: "run", div_id: container ? container.id : null });
        });
    });
    if (typeof eBookConfig !== "undefined" && !eBookConfig.isInstructor) {
        document.querySelectorAll(".commentary").forEach((el) => {
            el.style.display = "none";
        });
    }
}

window.addEventListener("load", function () {
    console.log("setting up pretext");
    setupPTXEvents();
    let wrap = document.getElementById("primary-navbar-sticky-wrapper");
    if (wrap) {
        wrap.style.overflow = "visible";
    }
});
