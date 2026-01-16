from enum import Enum


class QuestionType(Enum):
    ACTIVECODE = (
        "activecode",
        "Active Code",
        "Create an interactive coding exercise with real-time execution",
    )
    MCHOICE = (
        "mchoice",
        "Multiple Choice",
        "Create a multiple choice question with single or multiple correct answers",
    )
    SHORTANSWER = (
        "shortanswer",
        "Short Answer",
        "Create a question that requires a text response",
    )
    VIDEO = ("video", "Video", "")
    CODELENS = ("codelens", "Codelens", "")
    YOUTUBE = ("youtube", "Youtube", "")
    SELECTQUESTION = (
        "selectquestion",
        "Select question",
        "Create a question that allows students to select from a list of options",
    )
    CLICKABLEAREA = (
        "clickablearea",
        "Clickable Area",
        "Create an exercise where students identify areas in text or images",
    )
    DRAGNDROP = (
        "dragndrop",
        "Drag and Drop",
        "Create an exercise where students match or order items by dragging",
    )
    FILLINTHEBLANK = (
        "fillintheblank",
        "Fill in the blank",
        "Create a text with missing words that students need to fill in",
    )
    PARSONSPROB = (
        "parsonsprob",
        "Parsonsprob",
        "Create a programming exercise where students arrange code blocks in the correct order",
    )
    POLL = ("poll", "Poll", "Create a survey question to gather student feedback")
    HPARSONS = ("hparsons", "HParsons", "")
    ACTEX = ("actex", "Actex", "")
    MATCHING = (
        "matching",
        "Matching",
        "Create an exercise where students match items from two different sets",
    )
    PAGE = ("page", "Page", "")
    WEBWORK = ("webwork", "WeBWorK", "Create a WeBWorK problem for students to solve")
    IFRAME = (
        "iframe",
        "iFrame",
        "Embed external content using an iFrame",
    )

    def to_dict(self):
        return {
            "value": self.value[0],
            "label": self.value[1],
            "description": self.value[2],
        }

    def value_only(self):
        return self.value[0]

    @classmethod
    def all_types(cls):
        return [member for member in cls]
