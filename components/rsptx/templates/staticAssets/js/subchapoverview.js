/**
 * subchapoverview.js — Chapter Summary Report frontend logic
 *
 * Flow:
 *  1. Instructor selects chapter + report type, clicks "Generate Report"
 *  2. POST /analytics/subchapoverview/generate → receives task_id
 *  3. Poll GET /analytics/subchapoverview/result/{task_id} every 2s
 *  4. On complete: render Handsontable, show CSV download button
 *  5. On error: show error message
 */

(function () {
    "use strict";

    const POLL_INTERVAL_MS = 2000;

    let hotInstance = null;   // Handsontable instance
    let currentTaskId = null; // task_id currently being polled
    let pollTimer = null;     // setInterval handle

    // -------------------------------------------------------------------------
    // Public entry point — called by the Generate Report button
    // -------------------------------------------------------------------------
    window.generateReport = function () {
        const chapter = document.getElementById("chapter-select").value;
        const tablekind = document.querySelector('input[name="tablekind"]:checked').value;

        resetUI();
        showStatus("Submitting report request\u2026");

        fetch("/analytics/subchapoverview/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chapter, tablekind }),
        })
            .then(handleFetchError)
            .then((res) => res.json())
            .then((data) => {
                currentTaskId = data.task_id;
                showStatus("Building report\u2026");
                pollTimer = setInterval(pollResult, POLL_INTERVAL_MS);
            })
            .catch(showError);
    };

    // -------------------------------------------------------------------------
    // Public entry point — called by the Download CSV button
    // -------------------------------------------------------------------------
    window.downloadCSV = function () {
        if (!currentTaskId) return;
        window.location.href = `/analytics/subchapoverview/csv/${currentTaskId}`;
    };

    // -------------------------------------------------------------------------
    // Polling
    // -------------------------------------------------------------------------
    function pollResult() {
        if (!currentTaskId) return;

        fetch(`/analytics/subchapoverview/result/${currentTaskId}`)
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
                // else status === "pending" — keep polling
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
            showError("No data found for the selected chapter and report type.");
            return;
        }

        const resultsArea = document.getElementById("results-area");
        const container = document.getElementById("hot-container");

        resultsArea.style.display = "block";
        document.getElementById("row-count").textContent =
            `${data.length} row${data.length !== 1 ? "s" : ""}`;

        // Destroy previous instance if re-generating
        if (hotInstance) {
            hotInstance.destroy();
            hotInstance = null;
        }

        const keys = Object.keys(data[0]);
        const columns = keys.map((k) => ({ data: k, renderer: "html" }));
        const colHeaders = keys.map((k) => `<b>${escapeHtml(k)}</b>`);

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
