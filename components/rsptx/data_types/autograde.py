from enum import Enum
from typing import Optional

from rsptx.data_types.question_type import QuestionType

#: The ``question_type`` values whose only meaningful autograde policy is
#: interaction -- they have no correct answer to compare a student against.
INTERACTION_ONLY_QUESTION_TYPES = {
    qt.value_only() for qt in QuestionType.interaction_only_types()
}


def default_autograde_for(question_type: Optional[str], is_reading: bool) -> str:
    """Pick the initial autograde policy for a newly added assignment question.

    Reading questions are scored on interaction.  So are videos and polls, which
    have nothing to be correct about -- defaulting those to ``pct_correct``
    scores every student 0 no matter what they do.  Everything else defaults to
    percent correct.

    :param question_type: the ``Question.question_type`` of the question.
    :param is_reading: whether the question is being added to the reading
        (rather than the exercises) section of the assignment.
    :return: the autograde value to store on the new ``AssignmentQuestion``.
    """
    if is_reading:
        return "interaction"
    if question_type in INTERACTION_ONLY_QUESTION_TYPES:
        return "interact"
    return "pct_correct"


class AutogradeOptions(Enum):
    MANUAL = ("manual", "Manual", QuestionType.all_types())
    # Videos and polls have no correct answer, so offering these would silently
    # score every student 0 forever.  Interact is the only autograde policy that
    # means anything for them.
    ALL_OR_NOTHING = (
        "all_or_nothing",
        "All or nothing",
        QuestionType.correctness_gradable_types(),
    )
    PCT_CORRECT = (
        "pct_correct",
        "Pct correct",
        QuestionType.correctness_gradable_types(),
    )
    INTERACT = ("interact", "Interact", QuestionType.all_types())
    PEER = ("peer", "Peer", [QuestionType.MCHOICE])
    PEER_CHAT = ("peer_chat", "Peer chat", [QuestionType.MCHOICE])

    def to_dict(self):
        return {
            "value": self.value[0],
            "label": self.value[1],
            "supported_question_types": [qt.value_only() for qt in self.value[2]],
        }
