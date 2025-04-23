.. mchoice:: dz-lecture_2_5
   :author: Dan Zingaro
   :practice: T
   :answer_a: Yes
   :answer_b: No, because it contains an infinite number of steps
   :answer_c: No, because it never halts
   :answer_d: No, because step 3 is not well-defined
   :correct: c
   :feedback_a: Try again. Step 3 ends with returning to step 1. It never ends. But an algorithm must halt.
   :feedback_b: Try again. B is incorrect because there are three steps.
   :feedback_c: Correct! Because step 3 ends with returning to step 1. It never ends.
   :feedback_d: Try again. It is true that there are problems with step 3. But it is because step 3 makes it never halt.

   Is the following an algorithm?

   .. code-block:: python

      Step 1: write down the number 0
      Step 2: add 3
      Step 3: return to step 1

