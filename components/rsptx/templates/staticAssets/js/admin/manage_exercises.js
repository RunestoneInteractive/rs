/* Editorial page (admin/editor/manage_exercises.html).
   Edit or delete a flagged question, or clear its flag and leave it in the book.
   showAlert/postJSON come from admin/common.js. */

function removeCard(cardId) {
    const card = document.getElementById(cardId);

    if (card) {
        card.remove();
    }
    if (!document.querySelector("#questions .flagged-question")) {
        const list = document.getElementById("questions");

        if (list) {
            list.insertAdjacentHTML(
                "afterend",
                '<p id="no-questions">No questions are currently flagged for review.</p>'
            );
            list.remove();
        }
    }
}

async function postQuestionAction(url, qname, baseCourse, cardId, successMessage) {
    try {
        const data = await postJSON(url, { name: qname, base_course: baseCourse });

        if (data.detail && data.detail.status === "Success") {
            removeCard(cardId);
            showAlert(successMessage, "success");
        } else {
            const message = (data.detail && data.detail.message) || "Unknown error";
            showAlert(message, "error");
        }
    } catch (error) {
        showAlert(`Request failed: ${error.message}`, "error");
    }
}

function deleteQuestion(qname, baseCourse, cardId) {
    if (!confirm(`Really delete ${qname} from ${baseCourse}?`)) {
        return;
    }
    postQuestionAction(
        "/admin/editor/delete_question",
        qname,
        baseCourse,
        cardId,
        `Deleted ${qname}.`
    );
}

function clearFlag(qname, baseCourse, cardId) {
    postQuestionAction(
        "/admin/editor/clear_flag",
        qname,
        baseCourse,
        cardId,
        `Cleared the review flag on ${qname}.`
    );
}

async function saveQuestionEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    let questionJson;

    try {
        questionJson = JSON.parse(form.elements.question_json.value);
    } catch (error) {
        showAlert(`Question JSON is invalid: ${error.message}`, "error");
        return;
    }

    if (questionJson === null || Array.isArray(questionJson) || typeof questionJson !== "object") {
        showAlert("Question JSON must be an object.", "error");
        return;
    }

    try {
        const data = await postJSON(
            `/admin/editor/questions/${form.dataset.questionId}/edit`,
            { question_json: questionJson }
        );
        if (data.detail && data.detail.status === "Success") {
            window.location.assign("/admin/editor/manage_exercises");
            return;
        }
        const message = (data.detail && data.detail.message) || "Unknown error";
        showAlert(message, "error");
    } catch (error) {
        showAlert(`Request failed: ${error.message}`, "error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const editForm = document.getElementById("editorial-edit-form");

    if (editForm) {
        editForm.addEventListener("submit", saveQuestionEdit);
    }
});
