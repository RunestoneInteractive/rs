/* Course settings (admin/instructor/course_settings.html)
   Expects window.COURSE_SETTINGS_DATA = { timezone } set by the template. */

// Save a single setting whenever its control changes
async function updateCourse(element, setting) {
    try {
        let value;
        if (element.type === "checkbox") {
            value = element.checked ? "true" : "false";
        } else {
            value = element.value;
        }

        const result = await postJSON("/admin/instructor/update_course_setting", {
            setting: setting,
            value: value,
        });

        if (result.success) {
            showAlert("Setting updated successfully!", "success", 3000);
        } else {
            showAlert("Error updating setting: " + result.message, "error", 3000);
        }
    } catch (error) {
        showAlert("Error updating setting: " + error.message, "error", 3000);
    }
}

// Populate timezone selector and set a sensible default
(function initTimezoneSelector() {
    const select = document.getElementById("timezone_select");
    if (!select) return;

    const courseTz = window.COURSE_SETTINGS_DATA.timezone || "";
    const browserTz =
        (Intl &&
            Intl.DateTimeFormat &&
            Intl.DateTimeFormat().resolvedOptions().timeZone) ||
        "UTC";

    // Build a list of time zones: try supportedValuesOf; fallback to a curated list
    let tzList = [];
    try {
        if (Intl && typeof Intl.supportedValuesOf === "function") {
            tzList = Intl.supportedValuesOf("timeZone");
        }
    } catch (e) {
        // ignore and fall back
    }
    if (!tzList || tzList.length === 0) {
        tzList = [
            "UTC",
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Phoenix",
            "America/Anchorage",
            "Pacific/Honolulu",
            "Europe/London",
            "Europe/Paris",
            "Europe/Berlin",
            "Europe/Madrid",
            "Europe/Rome",
            "Asia/Tokyo",
            "Asia/Seoul",
            "Asia/Shanghai",
            "Asia/Kolkata",
            "Asia/Singapore",
            "Australia/Sydney",
            "Australia/Melbourne",
            "Pacific/Auckland",
        ];
    }

    // Sort for nicer UX
    tzList = Array.from(new Set(tzList)).sort((a, b) => a.localeCompare(b));

    tzList.forEach((tz) => {
        const opt = document.createElement("option");
        opt.value = tz;
        opt.textContent = tz;
        select.appendChild(opt);
    });

    // Decide which to select: prefer non-empty course timezone; otherwise browser
    const initialTz = courseTz && courseTz.trim() !== "" ? courseTz : browserTz;
    if (![...select.options].some((o) => o.value === initialTz)) {
        // Ensure it's selectable if not in the list
        const opt = document.createElement("option");
        opt.value = initialTz;
        opt.textContent = initialTz;
        select.appendChild(opt);
    }
    select.value = initialTz;

    // Show a hint with the detected browser tz and current course tz
    const hint = document.getElementById("tz_browser_hint");
    if (hint) {
        let msg = `Detected browser time zone: ${browserTz}`;
        if (courseTz && courseTz.trim() !== "") {
            msg += ` · Current course time zone: ${courseTz}`;
        }
        hint.textContent = msg;
    }

    // If there is no courseTz, save browserTz automatically
    if (!courseTz || courseTz.trim() === "") {
        updateCourse(select, "timezone");
    }
})();
