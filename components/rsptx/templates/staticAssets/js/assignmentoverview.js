/**
 * assignmentoverview.js — Assignment Summary Report frontend logic
 *
 * Flow:
 *  1. Instructor selects an assignment, clicks "Generate Report"
 *  2. POST /analytics/assignmentoverview/generate → receives task_id + assignment_id
 *  3. Poll GET /analytics/assignmentoverview/result/{task_id} every 2s
 *  4. On complete: render Handsontable; student column headers link to drilldown
 *  5. On error: show error message
 */

(function () {
    "use strict";

    const POLL_INTERVAL_MS = 2000;

    // Fixed stat columns that appear before the per-student columns.
    // These are not clickable links.
    const FIXED_COLS = new Set([
        "Question", "Type", "Points", "Interactions",
        "First", "Last", "# Correct", "# Incorrect", "# Never Tried", "Avg Score",
    ]);

    let hotInstance   = null;
    let currentTaskId = null;
    let currentAssignmentId = null;
    let pollTimer     = null;

    // -------------------------------------------------------------------------
    // Public entry point — Generate Report button
    // -------------------------------------------------------------------------
    window.generateReport = function () {
        const assignmentId = document.getElementById("assignment-select").value;
        if (!assignmentId) {
            alert("Please select an assignment.");
            return;
        }

        resetUI();
        showStatus("Submitting report request\u2026");

        fetch("/admin/analytics/assignmentoverview/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignment_id: assignmentId }),
        })
            .then(handleFetchError)
            .then((res) => res.json())
            .then((data) => {
                currentTaskId       = data.task_id;
                currentAssignmentId = data.assignment_id || assignmentId;
                showStatus("Building report\u2026");
                pollTimer = setInterval(pollResult, POLL_INTERVAL_MS);
            })
            .catch(showError);
    };

    // -------------------------------------------------------------------------
    // Public entry point — Download CSV button
    // -------------------------------------------------------------------------
    window.downloadCSV = function () {
        if (!currentTaskId) return;
        window.location.href = `/admin/analytics/assignmentoverview/csv/${currentTaskId}`;
    };

    // -------------------------------------------------------------------------
    // Polling
    // -------------------------------------------------------------------------
    function pollResult() {
        if (!currentTaskId) return;

        fetch(`/admin/analytics/assignmentoverview/result/${currentTaskId}`)
            .then(handleFetchError)
            .then((res) => res.json())
            .then((payload) => {
                if (payload.status === "complete") {
                    stopPolling();
                    renderTable(payload.data);
                } else if (payload.status === "error") {
                    stopPolling();
                    showError(payload.message || "An unknown error occurred.");
                }
                // else "pending" — keep polling
            })
            .catch((err) => {
                stopPolling();
                showError(err);
            });
    }

    function stopPolling() {
        if (pollTimer !== null) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        document.getElementById("generate-btn").disabled = false;
    }

    // -------------------------------------------------------------------------
    // Table rendering (Handsontable)
    // -------------------------------------------------------------------------
    function renderTable(data) {
        hideStatus();
        document.getElementById("error-area").style.display = "none";

        if (!data || data.length === 0) {
            showError("No data found for the selected assignment.");
            return;
        }

        const resultsArea = document.getElementById("results-area");
        const container   = document.getElementById("hot-container");

        resultsArea.style.display = "block";
        document.getElementById("row-count").textContent =
            `${data.length} question${data.length !== 1 ? "s" : ""}`;

        if (hotInstance) {
            hotInstance.destroy();
            hotInstance = null;
        }

        const keys    = Object.keys(data[0]);
        const columns = keys.map((k) => ({ data: k, renderer: scoreRenderer(k) }));
        const colHeaders = keys.map((k, i) => {
            if (i === 0) return `<b>${escapeHtml(k)}</b>`;
            if (FIXED_COLS.has(k)) return `<b>${escapeHtml(k)}</b>`;
            // Student column: "Last, First (username)" — extract username for link
            const match = k.match(/\(([^)]+)\)$/);
            const sid   = match ? match[1] : k;
            const label = escapeHtml(k);
            const url   = `/admin/analytics/assignmentoverview/student?sid=${encodeURIComponent(sid)}&assignment_id=${encodeURIComponent(currentAssignmentId)}`;
            return `<b><a href="${url}" target="_blank" style="color:inherit;">${label}</a></b>`;
        });

        hotInstance = new Handsontable(container, {
            data: data,
            columns: columns,
            colHeaders: colHeaders,
            licenseKey: "non-commercial-and-evaluation",
            fixedColumnsLeft: 1,
            readOnly: true,
            stretchH: "none",
            width: "100%",
            height: 560,
            rowHeaders: false,
            afterGetColHeader(col, TH) {
                TH.innerHTML = this.getSettings().colHeaders[col];
            },
        });
    }

    // Renderer: colour student score cells green (>0) or red (=0, not empty)
    function scoreRenderer(colKey) {
        return function (hotInstance, TD, row, col, prop, value) {
            Handsontable.renderers.HtmlRenderer.apply(this, arguments);
            if (!FIXED_COLS.has(colKey) && colKey !== "Question") {
                TD.style.color = "";
                TD.style.fontWeight = "";
                if (value !== null && value !== "" && value !== undefined) {
                    if (parseFloat(value) > 0) {
                        TD.style.color = "#2e7d32";
                        TD.style.fontWeight = "600";
                    } else {
                        TD.style.color = "#c62828";
                    }
                }
            }
        };
    }

    // -------------------------------------------------------------------------
    // UI helpers
    // -------------------------------------------------------------------------
    function resetUI() {
        stopPolling();
        document.getElementById("generate-btn").disabled = true;
        document.getElementById("results-area").style.display = "none";
        document.getElementById("error-area").style.display = "none";
        if (hotInstance) {
            hotInstance.destroy();
            hotInstance = null;
        }
        currentTaskId = null;
        currentAssignmentId = null;
    }

    function showStatus(msg) {
        document.getElementById("status-text").textContent = msg;
        document.getElementById("status-area").style.display = "block";
    }

    function hideStatus() {
        document.getElementById("status-area").style.display = "none";
    }

    function showError(err) {
        hideStatus();
        const area = document.getElementById("error-area");
        area.textContent = typeof err === "string" ? err : String(err);
        area.style.display = "block";
        document.getElementById("generate-btn").disabled = false;
    }

    function handleFetchError(response) {
        if (!response.ok) {
            return response.text().then((text) => {
                throw new Error(`Server error ${response.status}: ${text}`);
            });
        }
        return response;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
})();
