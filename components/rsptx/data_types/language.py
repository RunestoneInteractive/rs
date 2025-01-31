from enum import Enum

class LanguageOptions(Enum):
    PYTHON = ("python", "Python (in browser)")
    JAVA = ("java", "Java")
    CPP = ("cpp", "C++")
    C = ("c", "C")
    JAVASCRIPT = ("javascript", "Javascript")
    HTML = ("html", "HTML")
    SQL = ("sql", "SQL")

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
