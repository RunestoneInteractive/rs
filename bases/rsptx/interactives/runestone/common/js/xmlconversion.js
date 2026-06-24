/*
 * Base class for converting a question authored as XML into the JSON shape the
 * interactive components consume:
 *
 *   { statement, feedback,
 *     left:  [{id, label}, ...],   // <premise> elements
 *     right: [{id, label}, ...],   // <response> elements
 *     correctAnswers: [[leftId, rightId], ...] }
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
        this.doc = parser.parseFromString(xmlString, "text/html");
        const err = this.doc.querySelector("parsererror");
        if (err) {
            throw new Error("XML parse error: " + err.textContent);
        }
    }

    getStatement() {
        const el = this.doc.querySelector("statement");
        return el ? el.innerHTML.trim() : "";
    }

    getFeedback() {
        const el = this.doc.querySelector("feedback");
        return el ? el.innerHTML.trim() : "";
    }

    // Extract [{ id, label }, ...] from every <premise> or <response> element.
    // innerHTML preserves any markup inside the label.
    itemsFrom(tagName) {
        return Array.from(this.doc.querySelectorAll(tagName)).map((el) => {
            const idEl = el.querySelector("id");
            const labelEl = el.querySelector("label");
            return {
                id: idEl ? idEl.textContent.trim() : "",
                label: labelEl ? labelEl.innerHTML.trim() : "",
            };
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
