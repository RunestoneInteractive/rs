import { escapeHtml } from "../../common/js/domutil.js";

// The Java image/turtle libraries in the books print pictures as an img tag
// holding a base64 data: URI, written as "&ltimg", "&lt;img" or "<img".
const DATA_IMAGE =
    /(?:<|&lt;?)img\s+src=(["'])(data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]*)\1\s*\/?>/gi;

/**
 * Turn the text output of a student's program into HTML that is safe to
 * assign to innerHTML. Everything is escaped except well-formed base64
 * data:image tags, which are rebuilt from the URI so no other markup or
 * attributes survive.
 *
 * @param {string} text - raw stdout from the program
 * @param {{newlines?: boolean}} [options] - newlines: convert \n to <br>
 * @returns {string}
 */
export function programOutputToHtml(text, { newlines = false } = {}) {
    text = text ?? "";
    let html = "";
    let last = 0;
    for (const match of text.matchAll(DATA_IMAGE)) {
        html += escapeHtml(text.slice(last, match.index));
        html += `<img src="${match[2].replace(/\s/g, "")}"/>`;
        last = match.index + match[0].length;
    }
    html += escapeHtml(text.slice(last));
    if (newlines) {
        html = html.replace(/\n/g, "<br>");
    }
    return html;
}

/**
 * Escape compiler or error text and keep its line breaks.
 *
 * @param {string} text
 * @returns {string}
 */
export function errorTextToHtml(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
}
