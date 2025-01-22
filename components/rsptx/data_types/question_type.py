from enum import Enum

class QuestionType(Enum):
    ACTIVECODE = ("activecode", "Active Code")
    MCHOICE = ("mchoice", "Multiple Choice")
    SHORTANSWER = ("shortanswer", "Short Answer")
    VIDEO = ("video", "Video")
    CODELENS = ("codelens", "Codelens")
    YOUTUBE = ("youtube", "Youtube")
    SELECTQUESTION = ("selectquestion", "Select question")
    CLICKABLEAREA = ("clickablearea", "Clickable Area")
    DRAGNDROP = ("dragndrop", "Drag and Drop")
    FILLINTHEBLANK = ("fillintheblank", "Fill in the blank")
    PARSONSPROB = ("parsonsprob", "Parsonsprob")
    POLL = ("poll", "Poll")
    HPARSONS = ("hparsons", "HParsons")
    ACTEX = ("actex", "Actex")

    def to_dict(self):
        return {
            "value": self.value[0],
            "label": self.value[1],
        }

    def value_only(self):
        return self.value[0]

    @classmethod
    def all_types(cls):
        return [member for member in cls]
