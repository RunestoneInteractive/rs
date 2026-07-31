/* Rewrite server-rendered <time> elements into the viewer's local timezone.
 *
 * Deadlines are stored and sent as UTC instants. The server renders them in
 * the course timezone so the page is still correct without JavaScript, and
 * this script replaces that text with the same instant on the reader's own
 * clock. A student who is travelling then never has to convert a deadline
 * themselves.
 *
 * Markup produced by templates/core.py::course_datetime_tag:
 *
 *   <time datetime="2026-09-02T04:59:00Z"
 *         data-rs-localize="long"
 *         title="Sep 01, 2026 11:59 PM CDT course time">Sep 01, 2026 11:59 PM CDT</time>
 *
 * The timezone abbreviation is always shown, so the displayed time is never
 * ambiguous about which clock it refers to.
 */
(function () {
    "use strict";

    // Keep these in sync with DATETIME_STYLES in templates/core.py.
    var STYLES = {
        long: {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        },
        short: {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZoneName: "short",
        },
    };

    function localizeElement(el) {
        if (el.dataset.rsLocalized === "true") {
            return;
        }

        var stamp = el.getAttribute("datetime");
        if (!stamp) {
            return;
        }

        var when = new Date(stamp);
        if (isNaN(when.getTime())) {
            // Leave the server-rendered course-local text in place.
            return;
        }

        var options = STYLES[el.dataset.rsLocalize] || STYLES.long;
        try {
            el.textContent = when.toLocaleString(undefined, options);
            el.dataset.rsLocalized = "true";
        } catch (err) {
            /* Intl rejected the options; the fallback text stays. */
        }
    }

    function localizeTimes(root) {
        var scope = root || document;
        var nodes = scope.querySelectorAll("time[data-rs-localize]");
        for (var i = 0; i < nodes.length; i++) {
            localizeElement(nodes[i]);
        }
    }

    // Exposed so pages that inject markup after load can re-run it.
    window.rsLocalizeTimes = localizeTimes;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            localizeTimes();
        });
    } else {
        localizeTimes();
    }
})();
