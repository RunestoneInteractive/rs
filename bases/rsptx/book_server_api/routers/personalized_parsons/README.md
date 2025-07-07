### CodeTailor - Backend

The core logic of the CodeTailor backend involves capturing the student's current code from activecode and using it to generate a Parsons puzzle (in .rst), which is then sent back to the frontend.

In coach.py:
code in editor (activecode) --> Backend captures code --> Puzzle Generation with an LLM --> Response to Frontend (a scaffolding puzzle)

```text
book_server_api/
├── routers/
│   ├── personalized_parsons/
│   │   ├── end_to_end.py
│   │   ├── buggy_code_checker.py
│   │   ├── get_personalized_solution.py
│   │   ├── evaluate_fixed_code.py
│   │   ├── personalize_parsons.py
│   │   ├── personalize_common_solution.py
│   │   ├── generate_parsons_block.py
│   │   ├── get_parsons_code_distractor.py
│   │   ├── token_compare.py
│   │   ├── Material_Bank.csv
│   │   └── requirements.txt
├──coach.py


