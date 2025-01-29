from enum import Enum
from rsptx.data_types.question_type import QuestionType

class AutogradeOptions(Enum):
    MANUAL = ("manual", "Manual", QuestionType.all_types())
    ALL_OR_NOTHING = ("all_or_nothing", "All or nothing", QuestionType.all_types())
    PCT_CORRECT = ("pct_correct", "Pct correct", QuestionType.all_types())
    INTERACT = ("interact", "Interact", QuestionType.all_types())
    PEER = ("peer", "Peer", [QuestionType.MCHOICE])
    PEER_CHAT = ("peer_chat", "Peer chat", [QuestionType.MCHOICE])

    def to_dict(self):
        return {
            "value": self.value[0],
            "label": self.value[1],
            "supported_question_types": [qt.value_only() for qt in self.value[2]],
        }
