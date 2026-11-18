/**
 * student_answers.js — render a question with a student's answer restored
 *
 * Shared by the instructor drilldown pages. Each question waits in a
 * <template class="answer-src"> until the book's components have
 * auto-rendered the page, so none of them render it as the instructor. It is
 * then rendered in grader mode with the student's sid: the component fetches
 * and shows that student's answer, and logs nothing.
 *
 *   RSStudentAnswers.whenReady(fn);   // run fn once the page has logged in
 *   RSStudentAnswers.render(tpl, {
 *       sid: "...",
 *       deadline: Date | null,        // show the last answer before it
 *   });
 *
 * The element after the template is the host the question is rendered into.
 * A host with data-splice-state holds an iframe activity's saved states,
 * {"latest": ..., "beforeDeadline": ...}.
 */

(function () {
    "use strict";

    var ready = false;
    var waiting = [];

    document.addEventListener("runestone:login-complete", function () {
        // Let the components' own login-complete listeners run first.
        setTimeout(function () {
            ready = true;
            waiting.splice(0).forEach(function (fn) {
                fn();
            });
        }, 0);
    });

    function whenReady(fn) {
        if (ready) fn();
        else waiting.push(fn);
    }

    function render(tpl, opts) {
        // Start over from the stored source: a rendered component cannot be
        // told to reload a different answer.
        var host = tpl.nextElementSibling;
        var deadline = opts.deadline || null;
        if (host.dataset.spliceState !== undefined) {
            renderSpliceAnswer(host, tpl, deadline !== null);
            return;
        }
        host.replaceChildren(tpl.content.cloneNode(true));
        renderAnswer(host, opts.sid, deadline);
    }

    // Iframe activities (splice, doenet, iframe) ask the page's SPLICE
    // wrapper for their state, and it would answer with the *logged-in
    // user's* -- the instructor's. Register each frame with the student's
    // saved state before it loads, so the wrapper replays that instead and
    // drops anything the activity reports back.
    function renderSpliceAnswer(host, tpl, beforeDeadline) {
        var wrapper = window.spliceWrapper;
        host.querySelectorAll("iframe").forEach(function (f) {
            if (wrapper) wrapper.unregisterGraderFrame(f);
        });
        var states = {};
        try {
            states = JSON.parse(host.dataset.spliceState) || {};
        } catch (e) {
            console.error("Bad saved state for " + host.id, e);
        }
        var state = beforeDeadline ? states.beforeDeadline : states.latest;
        var frag = tpl.content.cloneNode(true);
        // Hold back each src so nothing loads before it is registered.
        var frames = Array.prototype.slice.call(frag.querySelectorAll("iframe"));
        var srcs = frames.map(function (f) {
            var src = f.getAttribute("src");
            f.removeAttribute("src");
            return src;
        });
        host.replaceChildren(frag);
        if (!wrapper) {
            var msg = document.createElement("p");
            msg.className = "no-data";
            msg.textContent = "This activity cannot show the student's work on this page.";
            host.replaceChildren(msg);
            return;
        }
        frames.forEach(function (f, i) {
            wrapper.registerGraderFrame(f, state ?? null);
            if (srcs[i]) f.src = srcs[i];
        });
        if (state == null) {
            var note = document.createElement("p");
            note.className = "no-data";
            note.textContent = "No saved work for this student.";
            host.prepend(note);
        }
    }

    async function renderAnswer(host, sid, deadline) {
        var orig = host.querySelector("[data-component]");
        // Without a data-component (older WeBWorK markup) there is nothing to
        // restore an answer into; leave the question text as it is.
        if (!orig) return;
        var kind = orig.dataset.component;
        try {
            await window.runestoneComponents.runestone_import(kind);
        } catch (e) {
            // Iframe-hosted kinds (splice, doenet, khanex) have no module;
            // their markup is already the whole question.
            return;
        }
        try {
            var langEl = orig.dataset.lang ? orig : orig.querySelector("[data-lang]");
            var opts = {
                orig: orig,
                lang: langEl ? langEl.dataset.lang : undefined,
                useRunestoneServices: true,
                graderactive: true,
                sid: sid,
                python3: true,
            };
            if (deadline) {
                // Sent to the server, which returns the last answer before it;
                // activecode moves its history scrubber to the deadline too.
                opts.enforceDeadline = true;
                opts.deadline = deadline;
            }
            var component = window.component_factory[kind](opts);
            window.componentMap[orig.id] = component;
        } catch (e) {
            console.error("Could not render " + kind + " " + orig.id, e);
            var msg = document.createElement("p");
            msg.className = "no-data";
            msg.textContent = "This " + kind + " question could not be rendered.";
            host.appendChild(msg);
        }
    }

    window.RSStudentAnswers = { whenReady: whenReady, render: render };
})();
