
    .. mchoice:: uniqueid
        :multiple_answers: [optional]. Implied if ``:correct:`` contains a list.
        :random: [optional]

        The following arguments supply answers and feedback. See below for an alternative method of specification.

        :correct: letter of correct answer choice
        :answer_a: answer choice  -- what follows the _ is the answer's label.
        :answer_b: answer choice
        :answer_c: answer choice
        :answer_d: answer choice
        :answer_e: answer choice
        :feedback_a: displayed if a is picked
        :feedback_b: displayed if b is picked
        :feedback_c: displayed if c is picked
        :feedback_d: displayed if d is picked
        :feedback_e: displayed if e is picked

        Question text; this may contain multiple paragraphs with any markup.

        An alternative method of specifying answers and feedback: Place an `unordered list <http://www.sphinx-doc.org/en/stable/rest.html#lists-and-quote-like-blocks>`_ at the end of the question text, in the following format. Note: If your question text happens to end with an unordered list, then place a comment, consisting of a paragraph containing only ``..`` at the end of the list. For example:

        -   This list is still part of the question text.

        ..

        -   Text for answer A.

            Your text may be multiple paragraphs, including `images <http://www.sphinx-doc.org/en/stable/rest.html#images>`_
            and any other `inline <http://www.sphinx-doc.org/en/stable/rest.html#inline-markup>`_ or block markup. For example: :math:`\sqrt(2)/2`. As earlier, if your feedback contains an unordered list, end it with a comment.

            -   For example, this is part of the answer text.

            ..

            +   This is feedback for answer A. This is a correct answer because the bullet is a ``+``.

                This may also span multiple paragraphs and include any markup.
                However, there can be only one item in this unordered list.

        -   Text for answer B.

            -   Feedback for answer B. This is an incorrect answer, because the bullet is not a ``+``.
        -   Text for answer C. Note that the empty line between a sublist and a list may be omitted.

            +   Feedback for answer C, which is a correct answer. However, the empty line is required between a list and a sublist.

        -   ... and so on.

            -   Up to 26 answers and feedback pairs may be provided.

    config values (conf.py):

    - mchoice_div_class - custom CSS class of the component's outermost div