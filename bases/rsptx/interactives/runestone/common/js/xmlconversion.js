/*
 * Base class for converting a question authored as XML into the JSON shape the
 * interactive components consume:
 *
 *   { statement, feedback,
 *     left:  [{id, label, feedback?}, ...],   // <premise> elements
 *     right: [{id, label, feedback?}, ...],   // <response> elements
 *     correctAnswers: [[leftId, rightId], ...] }
 *
 * A <premise> or <response> may carry its own <feedback> (PreTeXt "cardsort"
 * with feedback on cards); it is included only when present and non-empty.
 *
 * The pieces every question type shares -- parsing, the <statement>/<feedback>
 * tags, and the <premise>/<response> lists -- live here. How the answer key is
 * expressed differs between components, so subclasses override correctAnswers().
 */
export class QuestionXmlConverter {
    constructor(xmlString) {
        const parser = new DOMParser();
        // Parse as HTML so that markup inside <statement>/<label> (e.g. <p>,
        // math spans) is preserved and reachable via innerHTML.
        this.doc = parser.parseFromString(
            expandSelfClosingTags(xmlString),
            "text/html",
        );
        const err = this.doc.querySelector("parsererror");
        if (err) {
            throw new Error("XML parse error: " + err.textContent);
        }
        // The question's root element, e.g. <dragndrop> or <matching>.
        this.root = this.doc.body.firstElementChild || this.doc.body;
    }

    // The question-level <statement> or <feedback>: a child of the root, not
    // the <feedback> of a card, which may come first in document order.
    rootChild(tagName) {
        return (
            childElement(this.root, tagName) || this.doc.querySelector(tagName)
        );
    }

    getStatement() {
        const el = this.rootChild("statement");
        return el ? el.innerHTML.trim() : "";
    }

    getFeedback() {
        const el = this.rootChild("feedback");
        return el ? el.innerHTML.trim() : "";
    }

    // Extract [{ id, label, feedback? }, ...] from every <premise> or
    // <response> element. innerHTML preserves any markup inside the label.
    itemsFrom(tagName) {
        return Array.from(this.doc.querySelectorAll(tagName)).map((el) => {
            const idEl = childElement(el, "id");
            const labelEl = childElement(el, "label");
            const feedbackEl = childElement(el, "feedback");
            const item = {
                id: idEl ? idEl.textContent.trim() : "",
                label: labelEl ? labelEl.innerHTML.trim() : "",
            };
            const feedback = feedbackEl ? feedbackEl.innerHTML.trim() : "";
            if (feedback) {
                item.feedback = feedback;
            }
            return item;
        });
    }

    // Returns the answer key as [[leftId, rightId], ...]. The way answers are
    // expressed in the XML is component specific, so subclasses must implement
    // this.
    correctAnswers() {
        throw new Error(
            "correctAnswers() must be implemented by a subclass of QuestionXmlConverter",
        );
    }

    toJson() {
        return {
            statement: this.getStatement(),
            feedback: this.getFeedback(),
            left: this.itemsFrom("premise"),
            right: this.itemsFrom("response"),
            correctAnswers: this.correctAnswers(),
        };
    }
}

function childElement(parent, tagName) {
    return Array.from(parent.children).find(
        (child) => child.localName === tagName,
    );
}

// HTML elements that are legitimately written as <tag/>.
const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

/*
 * The HTML parser ignores the slash in <feedback/> and treats it as an open
 * tag, so everything after it would end up inside the empty element. An XML
 * serializer (lxml, when the manifest is stored in the database) writes empty
 * elements that way, e.g. an exercise with no <feedback> or an <answer/>.
 */
function expandSelfClosingTags(xmlString) {
    return xmlString.replace(
        /<([A-Za-z][\w:-]*)((?:\s+[^<>]*?)?)\s*\/>/g,
        (match, tag, attrs) =>
            VOID_ELEMENTS.has(tag.toLowerCase())
                ? match
                : `<${tag}${attrs}></${tag}>`,
    );
}
