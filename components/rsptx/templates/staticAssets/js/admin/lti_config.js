/* LTI configuration page (admin/instructor/lti_config.html).
   Manages LTI 1.1 key/secret creation and removal, plus the LTI 1.3
   association removal and options.  Relies on postJSON / showAlert from
   common.js. */

// --- LTI 1.1 ---------------------------------------------------------------

// Create a consumer key and secret for this course.
async function generateLTIKeys() {
    if (document.getElementById("ckey_value").textContent.trim() !== "") {
        if (!confirm("Whoa! You already have a key and secret. Are you sure?")) {
            return;
        }
    }
    try {
        const data = await postJSON("/admin/instructor/create_lti_keys", {});
        if (data.consumer) {
            document.getElementById("ckey_value").textContent = data.consumer;
            setSecret(data.secret);
            document.getElementById("create_lti").disabled = true;
            document.getElementById("delete_lti").disabled = false;
            document.getElementById("show_secret").disabled = false;
            showAlert("LTI key and secret created.", "success", 3000);
        } else {
            showAlert("Hmmm, failed to create keys.", "error", 4000);
        }
    } catch (error) {
        showAlert("Error creating keys: " + error.message, "error", 4000);
    }
}

// Remove the consumer key and secret for this course.
async function deleteLTIKeys() {
    if (!confirm("Really delete the LTI keys?")) {
        return;
    }
    try {
        const data = await postJSON("/admin/instructor/delete_lti_keys", {});
        if (data.detail && data.detail.status === "success") {
            document.getElementById("ckey_value").textContent = "";
            setSecret("");
            document.getElementById("create_lti").disabled = false;
            document.getElementById("delete_lti").disabled = true;
            const showBtn = document.getElementById("show_secret");
            showBtn.disabled = true;
            showBtn.textContent = "Show Secret";
            showAlert("LTI key and secret removed.", "success", 3000);
        } else {
            showAlert("Failed to delete keys.", "error", 4000);
        }
    } catch (error) {
        showAlert("Error deleting keys: " + error.message, "error", 4000);
    }
}

// Store the secret value on the element (masked) and reset the toggle.
function setSecret(secret) {
    const el = document.getElementById("secret_value");
    el.dataset.secret = secret || "";
    el.textContent = secret ? "••••••••" : "";
    document.getElementById("show_secret").textContent = "Show Secret";
}

// Reveal or hide the secret.
function toggleSecret() {
    const el = document.getElementById("secret_value");
    const btn = document.getElementById("show_secret");
    const secret = el.dataset.secret || "";
    if (!secret) return;
    if (btn.textContent === "Show Secret") {
        el.textContent = secret;
        btn.textContent = "Hide Secret";
    } else {
        el.textContent = "••••••••";
        btn.textContent = "Show Secret";
    }
}

// --- LTI 1.3 ---------------------------------------------------------------

// Remove this course's LTI 1.3 association.
async function deleteLTI1p3() {
    if (!confirm("Really delete the LTI 1.3 association?")) {
        return;
    }
    try {
        const response = await fetch("/admin/lti1p3/remove-association");
        const data = await response.json();
        if (data.detail && data.detail.status === "success") {
            showAlert("LTI 1.3 association removed.", "success", 3000);
        } else {
            showAlert("Failed to disassociate LTI 1.3.", "error", 4000);
        }
    } catch (error) {
        showAlert("Error removing association: " + error.message, "error", 4000);
    }
}

// Save a single course setting (used by the LTI 1.3 option checkboxes).
async function updateCourse(element, setting) {
    try {
        const value =
            element.type === "checkbox"
                ? element.checked
                    ? "true"
                    : "false"
                : element.value;
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

// --- Clipboard helpers -----------------------------------------------------

function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return;
    }
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
}

function copyElementToClipboard(elid) {
    copyText(document.getElementById(elid).textContent);
}

function copySecretToClipboard() {
    copyText(document.getElementById("secret_value").dataset.secret || "");
}
