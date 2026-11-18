import { load } from "../../common/js/rsi18n.js";

load({
    en: {
        msg_no_answer: "No answer provided.",
        msg_fitb_check_me: "Check me",
        msg_fitb_compare_me: "Compare me",
        msg_fitb_randomize: "Randomize",
        // Accessible names. A screen reader reads only a field's own name when
        // focus lands on it, so the prompt has to travel with the blank.
        // $1 = blank number, $2 = number of blanks, $3 = the prompt text.
        msg_fitb_blank_label: "Blank $1 of $2. $3",
        // $1 = the prompt text.
        msg_fitb_blank_label_single: "Fill in the blank. $1",
        // Used when the prompt has no text to read, e.g. an image-only problem.
        msg_fitb_blank_fallback: "Blank $1 of $2",
        msg_fitb_blank_fallback_single: "Fill in the blank",
        // How a blank is spoken where it appears in the prompt text. $1 = its
        // number.
        msg_fitb_blank_n: "blank $1",
        msg_fitb_group_label: "Fill in the blank question",
        // $1 = the question number shown in the caption.
        msg_fitb_group_label_numbered: "Fill in the blank question $1",
        msg_fitb_correct: "Correct:",
        msg_fitb_incorrect: "Incorrect:",
        msg_fitb_result_correct: "All blanks correct.",
        msg_fitb_result_incorrect: "Some blanks are incorrect.",
        msg_fitb_top_answers: "Top Answers",
        msg_fitb_close: "Close",
    },
});
