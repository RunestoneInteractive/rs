from enum import Enum
from rsptx.data_types.question_type import QuestionType

class WhichToGradeOptions(Enum):
    FIRST_ANSWER = ("first_answer", "First answer", QuestionType.all_types())
    LAST_ANSWER = ("last_answer", "Last answer", QuestionType.all_types())
    BEST_ANSWER = ("best_answer", "Best answer", QuestionType.all_types())
    ALL_ANSWER = ("all_answer", "All peer votes", [QuestionType.MCHOICE])

    def to_dict(self):
        return {
            "value": self.value[0],
            "label": self.value[1],
            "supported_question_types": [qt.value_only() for qt in self.value[2]],
        }
