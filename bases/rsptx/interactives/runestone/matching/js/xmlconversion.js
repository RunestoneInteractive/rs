import { QuestionXmlConverter } from "../../common/js/xmlconversion.js";

/*
 * Matching expresses its answer key as <edge> elements, each holding two
 * <label> children whose text content are the premise and response ids:
 *
 *   <edge><label>left-1</label><label>right-2</label></edge>
 */
export class MatchingXmlConverter extends QuestionXmlConverter {
    correctAnswers() {
        return Array.from(this.doc.querySelectorAll("edge")).map((edgeEl) =>
            // take the first two <label> children as the [premise, response] pair
            Array.from(edgeEl.querySelectorAll("label"))
                .slice(0, 2)
                .map((l) => l.textContent.trim()),
        );
    }
}
