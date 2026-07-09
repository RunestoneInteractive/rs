import { QuestionXmlConverter } from "../../common/js/xmlconversion.js";

/*
 * Drag-n-drop expresses its answer key as <answer> elements with premise and
 * response id attributes, which reads more clearly than matching's <edge> form:
 *
 *   <answer premise="left-1" response="right-2"/>
 *
 * Several <answer>s may share the same response (many premises -> one dropzone).
 */
export class DragndropXmlConverter extends QuestionXmlConverter {
    correctAnswers() {
        return Array.from(this.doc.querySelectorAll("answer")).map((a) => [
            a.getAttribute("premise"),
            a.getAttribute("response"),
        ]);
    }
}
