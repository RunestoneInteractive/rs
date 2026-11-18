/* ***********************************
 * |docname| - MathJax accessibility helpers
 * ***********************************
 * Utilities for interactive elements that contain MathJax-rendered content.
 */

const mathSpeechSelector =
    "mjx-container, .MathJax, [data-semantic-speech-none]";
const mathSpeechDescendantSelector =
    "mjx-container[aria-label], .MathJax[aria-label], [data-semantic-speech-none]";

/**
 * Return MathJax's speech text for a rendered math element.
 */
export function getMathJaxSpeechText(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return "";
    }
    if (!element.matches(mathSpeechSelector)) {
        return "";
    }
    return (
        element.getAttribute("data-semantic-speech-none") ||
        element.getAttribute("aria-label") ||
        ""
    )
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Return the speech text from the first MathJax descendant of an element.
 */
export function getMathJaxSpeechDescendantText(element) {
    return getMathJaxSpeechText(
        element?.querySelector?.(mathSpeechDescendantSelector),
    );
}

/**
 * Return an accessible text equivalent for content that can include MathJax.
 */
export function getAccessibleElementText(element) {
    const parts = [];
    const visit = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.textContent);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }
        const nodeElement = node;
        const speechText = getMathJaxSpeechText(nodeElement);
        if (speechText) {
            parts.push(speechText);
            return;
        }
        if (nodeElement.matches(".process-math")) {
            const descendantSpeech =
                getMathJaxSpeechDescendantText(nodeElement);
            if (descendantSpeech) {
                parts.push(descendantSpeech);
                return;
            }
        }
        if (nodeElement.getAttribute("aria-hidden") === "true") {
            return;
        }
        if (nodeElement.tagName === "IMG") {
            parts.push(nodeElement.getAttribute("alt") || "");
            return;
        }
        for (const child of nodeElement.childNodes) {
            visit(child);
        }
    };
    if (element) {
        visit(element);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Remove rendered MathJax content from the tab order within each container.
 */
export function disableMathJaxTabStops(root, containerSelectors) {
    const mathSelectors = [
        ".MathJax",
        "mjx-container",
        ".process-math",
        ".MathJax [tabindex]",
        "mjx-container [tabindex]",
        ".process-math [tabindex]",
    ];
    const selector = containerSelectors
        .flatMap((containerSelector) =>
            mathSelectors.map(
                (mathSelector) => containerSelector + " " + mathSelector,
            ),
        )
        .join(", ");
    for (const mathElement of root.querySelectorAll(selector)) {
        mathElement.setAttribute("tabindex", "-1");
    }
}
