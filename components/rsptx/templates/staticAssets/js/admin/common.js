/* Shared helpers for the admin server pages.
   Loaded by admin/_admin_base.html on every page. */

/**
 * Show a transient message in the page's #alert-container element.
 * type is one of success | error | warning | info (matches the
 * .alert-* classes in admin.css).
 */
function showAlert(message, type, timeout = 5000) {
    const alertContainer = document.getElementById("alert-container");
    if (!alertContainer) {
        alert(message);
        return;
    }
    const alertBox = document.createElement("div");
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;

    alertContainer.innerHTML = "";
    alertContainer.appendChild(alertBox);

    setTimeout(() => {
        alertBox.remove();
    }, timeout);
}

/**
 * POST a JSON body and return the parsed JSON response.
 */
async function postJSON(url, data) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return response.json();
}
