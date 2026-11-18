/**
 * grade_dialog.js — a modal for setting one student's grade on one question.
 *
 * Reusable on any instructor page: include this script and
 * /staticAssets/css/grade_dialog.css, then call
 *
 *     RSGradeDialog.open({
 *         sid: "student1",          // whose grade
 *         divId: "q_name",          // question name (a selectquestion's own name)
 *         assignmentId: 42,         // optional: whose total to roll up
 *         score: 3, maxPoints: 5,   // current score ("" for none) and the maximum
 *         comment: "",              // current comment for the student
 *         title: "Question 2",      // optional heading
 *     }).then(function (saved) {
 *         // saved is null when cancelled; otherwise the server's reply:
 *         // {score, comment, sid, div_id, recomputed_assignments, totals}
 *     });
 *
 * Saving posts to the grader's /grade endpoint, which marks the score as hand
 * entered (so the autograder leaves it alone) and recomputes the student's
 * assignment total.
 */

(function () {
    "use strict";

    var GRADE_URL = "/assignment/instructor/grader/grade";
    var dialog = null;
    var current = null; // {opts, resolve} for the dialog that is open

    function build() {
        dialog = document.createElement("dialog");
        dialog.className = "rs-grade-dialog";
        dialog.setAttribute("aria-labelledby", "rs-grade-dialog-title");
        dialog.innerHTML =
            '<form method="dialog" novalidate>' +
            '  <h2 id="rs-grade-dialog-title"></h2>' +
            '  <p class="rs-grade-dialog-subtitle"></p>' +
            '  <div class="rs-grade-dialog-field">' +
            '    <label for="rs-grade-dialog-score">Score</label>' +
            '    <span class="rs-grade-dialog-score">' +
            '      <input type="number" id="rs-grade-dialog-score" name="score"' +
            '             step="any" min="0" required inputmode="decimal" />' +
            '      <span class="rs-grade-dialog-max"></span>' +
            "    </span>" +
            "  </div>" +
            '  <div class="rs-grade-dialog-field">' +
            '    <label for="rs-grade-dialog-comment">Comment for the student</label>' +
            '    <textarea id="rs-grade-dialog-comment" name="comment" rows="4"></textarea>' +
            "  </div>" +
            '  <p class="rs-grade-dialog-error" role="alert"></p>' +
            '  <div class="rs-grade-dialog-actions">' +
            '    <button type="button" class="btn btn-outline-secondary" value="cancel">Cancel</button>' +
            '    <button type="submit" class="btn btn-primary" value="save">Save grade</button>' +
            "  </div>" +
            "</form>";
        document.body.appendChild(dialog);

        var form = dialog.querySelector("form");
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            save();
        });
        dialog
            .querySelector('button[value="cancel"]')
            .addEventListener("click", function () {
                dialog.close();
            });
        // Escape, Cancel, or a click on the backdrop all end up here.  None of
        // them may close the dialog while a save is in flight: its reply is
        // what the caller is waiting for.
        dialog.addEventListener("cancel", function (e) {
            if (isBusy()) e.preventDefault();
        });
        dialog.addEventListener("close", function () {
            finish(null);
        });
        dialog.addEventListener("click", function (e) {
            // The form fills the dialog, so only the backdrop is the dialog itself.
            if (e.target === dialog && !isBusy()) dialog.close();
        });
    }

    function el(selector) {
        return dialog.querySelector(selector);
    }

    function finish(result) {
        if (!current) return;
        var resolve = current.resolve;
        current = null;
        resolve(result);
    }

    function showError(message) {
        el(".rs-grade-dialog-error").textContent = message || "";
    }

    function setBusy(busy) {
        var submit = el('button[type="submit"]');
        submit.disabled = busy;
        submit.textContent = busy ? "Saving…" : "Save grade";
        el('button[value="cancel"]').disabled = busy;
    }

    function isBusy() {
        return el('button[type="submit"]').disabled;
    }

    async function save() {
        var opts = current.opts;
        var scoreInput = el("#rs-grade-dialog-score");
        var raw = scoreInput.value.trim();
        var score = Number(raw);
        if (raw === "" || !isFinite(score) || score < 0) {
            showError("Enter a score of 0 or more.");
            scoreInput.focus();
            return;
        }
        showError("");
        setBusy(true);
        try {
            var resp = await fetch(opts.gradeUrl || GRADE_URL, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sid: opts.sid,
                    div_id: opts.divId,
                    score: score,
                    comment: el("#rs-grade-dialog-comment").value,
                    assignment_id: opts.assignmentId == null ? null : opts.assignmentId,
                }),
            });
            var body = await resp.json().catch(function () {
                return {};
            });
            if (!resp.ok) {
                var detail = body && body.detail;
                showError(
                    "The grade was not saved: " +
                        (typeof detail === "string" ? detail : resp.status + " " + resp.statusText)
                );
                return;
            }
            var result = body.detail || {};
            // Resolve before closing, so the close handler finds nothing to cancel.
            finish(result);
            dialog.close();
        } catch (e) {
            showError("The grade was not saved: " + e.message);
        } finally {
            setBusy(false);
        }
    }

    function open(opts) {
        if (!dialog) build();
        if (current) {
            // Only one at a time; treat a second open as cancelling the first.
            finish(null);
        }
        el("#rs-grade-dialog-title").textContent = opts.title || "Edit grade";
        el(".rs-grade-dialog-subtitle").textContent = opts.subtitle || "";
        el(".rs-grade-dialog-subtitle").hidden = !opts.subtitle;
        var scoreInput = el("#rs-grade-dialog-score");
        scoreInput.value = opts.score == null ? "" : String(opts.score);
        el(".rs-grade-dialog-max").textContent =
            opts.maxPoints == null ? "" : "/ " + opts.maxPoints;
        el("#rs-grade-dialog-comment").value = opts.comment || "";
        showError("");
        setBusy(false);

        return new Promise(function (resolve) {
            current = { opts: opts, resolve: resolve };
            dialog.showModal();
            scoreInput.focus();
            scoreInput.select();
        });
    }

    window.RSGradeDialog = { open: open };
})();
