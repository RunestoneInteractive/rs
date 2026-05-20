import type { Assignment } from "@/types/assignment";
import type {
  GraderAnswersResponse,
  GraderHistoryResponse,
  GraderQuestionsResponse,
  GraderStudentAnswer
} from "@store/grader/grader.logic.api";

export const DEMO_ASSIGNMENT_ID = 900001;
export const DEMO_ALT_ASSIGNMENT_ID = 900002;
export const DEMO_ALT2_ASSIGNMENT_ID = 900003;

export const DEMO_QUESTION_ID = 910001;
export const DEMO_ACTIVECODE_QID = 910002;
export const DEMO_PARSONS_QID = 910003;
export const DEMO_FITB_QID = 910004;
export const DEMO_SHORT_QID = 910005;
export const DEMO_CLICKABLE_QID = 910006;
export const DEMO_DND_QID = 910007;
export const DEMO_CODELENS_QID = 910008;
export const DEMO_MATCHING_QID = 910009;
export const DEMO_WEBWORK_QID = 910010;

export const DEMO_STUDENT_SID = "demo-student-1";

export const DEMO_MCHOICE_HTMLSRC = `
<div class="runestone alert alert-warning" style="max-width: 760px;">
  <div data-component="multiplechoice" data-question_label="Q1" id="q_loops_mchoice" class="question">
    <p><strong>Question:</strong> Which loop iterates exactly <em>five</em> times and prints the numbers 0 through 4?</p>
    <form name="q_loops_mchoice_form" onsubmit="return false;">
      <ul style="list-style: none; padding-left: 0; margin: 0.5rem 0;">
        <li style="margin: 0.35rem 0;">
          <label style="display: flex; gap: 0.5rem; align-items: flex-start; cursor: default;">
            <input type="radio" name="group_q_loops_mchoice" value="0" checked disabled />
            <span><code>for i in range(5): print(i)</code><br/>
              <small style="color:#16a34a;">Correct — <code>range(5)</code> yields 0,1,2,3,4.</small>
            </span>
          </label>
        </li>
        <li style="margin: 0.35rem 0;">
          <label style="display: flex; gap: 0.5rem; align-items: flex-start; cursor: default;">
            <input type="radio" name="group_q_loops_mchoice" value="1" disabled />
            <span><code>for i in range(1, 5): print(i)</code><br/>
              <small style="color:#dc2626;">Incorrect — only prints 1,2,3,4 (four values).</small>
            </span>
          </label>
        </li>
        <li style="margin: 0.35rem 0;">
          <label style="display: flex; gap: 0.5rem; align-items: flex-start; cursor: default;">
            <input type="radio" name="group_q_loops_mchoice" value="2" disabled />
            <span><code>i = 0
while i &lt; 5: i += 1; print(i)</code><br/>
              <small style="color:#dc2626;">Incorrect — prints 1..5, not 0..4.</small>
            </span>
          </label>
        </li>
        <li style="margin: 0.35rem 0;">
          <label style="display: flex; gap: 0.5rem; align-items: flex-start; cursor: default;">
            <input type="radio" name="group_q_loops_mchoice" value="3" disabled />
            <span><code>for i in [1,2,3,4,5]: print(i)</code><br/>
              <small style="color:#dc2626;">Incorrect — prints 1..5.</small>
            </span>
          </label>
        </li>
      </ul>
      <button type="button" class="btn btn-success" disabled style="opacity: 0.7;">Check Me</button>
      <button type="button" class="btn btn-default" disabled style="opacity: 0.7; margin-left: 0.35rem;">Compare Me</button>
      <div style="margin-top: 0.6rem; padding: 0.55rem 0.75rem; border-radius: 6px; background: #ecfeff; border: 1px solid #a5f3fc; color: #155e75; font-size: 13px;">
        <strong>Feedback:</strong> Review how <code>range(n)</code> produces the sequence <code>0 .. n-1</code>.
      </div>
    </form>
  </div>
</div>
`;

const iso = (d: Date) => d.toISOString();
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

const baseAssignment = {
  updated_date: null,
  visible_on: null,
  hidden_on: null,
  visible: true,
  is_peer: false,
  is_timed: false,
  nofeedback: false,
  nopause: false,
  time_limit: null,
  peer_async_visible: false,
  exercises: [] as [],
  all_assignments: [] as [],
  search_results: [] as [],
  isAuthorized: true,
  released: true,
  selectedAssignments: [] as [],
  course: 0,
  threshold_pct: null,
  allow_self_autograde: null,
  from_source: false,
  current_index: 0,
  enforce_due: false
};

export const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    ...baseAssignment,
    id: DEMO_ASSIGNMENT_ID,
    name: "Demo – Week 3: Loops & Functions",
    description:
      "Sample assignment used by the tour — covers every question type supported by the grader.",
    duedate: daysFromNow(4),
    points: 40,
    kind: "Regular",
    question_count: 10
  },
  {
    ...baseAssignment,
    id: DEMO_ALT_ASSIGNMENT_ID,
    name: "Demo – Week 4: Lists & Dictionaries",
    description:
      "Second demo assignment, shown so the picker grid is not a lone card.",
    duedate: daysFromNow(11),
    points: 30,
    kind: "Regular",
    question_count: 6
  },
  {
    ...baseAssignment,
    id: DEMO_ALT2_ASSIGNMENT_ID,
    name: "Demo – Peer review: Algorithms",
    description: "A third demo so the grid renders at least one row comfortably.",
    duedate: daysFromNow(18),
    points: 20,
    is_peer: true,
    peer_async_visible: true,
    kind: "Peer",
    question_count: 4
  }
];

export const DEMO_QUESTIONS: GraderQuestionsResponse = {
  assignment: {
    id: DEMO_ASSIGNMENT_ID,
    name: DEMO_ASSIGNMENTS[0].name,
    description: DEMO_ASSIGNMENTS[0].description,
    duedate: DEMO_ASSIGNMENTS[0].duedate,
    points: DEMO_ASSIGNMENTS[0].points
  },
  questions: [
    {
      id: DEMO_QUESTION_ID,
      name: "q_loops_mchoice",
      question_type: "mchoice",
      points: 5,
      autograde: "all_or_nothing",
      which_to_grade: "best_answer",
      answered_count: 22,
      correct_count: 17,
      average_score: 3.9
    },
    {
      id: DEMO_ACTIVECODE_QID,
      name: "q_reverse_list_ac",
      question_type: "activecode",
      points: 8,
      autograde: "unittest",
      which_to_grade: "last_answer",
      answered_count: 20,
      correct_count: 11,
      average_score: 5.2
    },
    {
      id: DEMO_PARSONS_QID,
      name: "q_swap_parsons",
      question_type: "parsonsprob",
      points: 4,
      autograde: "manual",
      which_to_grade: "best_answer",
      answered_count: 18,
      correct_count: 14,
      average_score: 3.4
    },
    {
      id: DEMO_FITB_QID,
      name: "q_syntax_fitb",
      question_type: "fillintheblank",
      points: 3,
      autograde: "all_or_nothing",
      which_to_grade: "first_answer",
      answered_count: 24,
      correct_count: 19,
      average_score: 2.6
    },
    {
      id: DEMO_SHORT_QID,
      name: "q_explain_shortanswer",
      question_type: "shortanswer",
      points: 6,
      autograde: "manual",
      which_to_grade: "manual",
      answered_count: 15,
      correct_count: 0,
      average_score: 3.1
    },
    {
      id: DEMO_CLICKABLE_QID,
      name: "q_find_bug_click",
      question_type: "clickablearea",
      points: 3,
      autograde: "all_or_nothing",
      which_to_grade: "best_answer",
      answered_count: 19,
      correct_count: 12,
      average_score: 2.0
    },
    {
      id: DEMO_DND_QID,
      name: "q_order_steps_dnd",
      question_type: "dragndrop",
      points: 4,
      autograde: "all_or_nothing",
      which_to_grade: "best_answer",
      answered_count: 17,
      correct_count: 10,
      average_score: 2.6
    },
    {
      id: DEMO_CODELENS_QID,
      name: "q_trace_codelens",
      question_type: "codelens",
      points: 3,
      autograde: "interact",
      which_to_grade: "last_answer",
      answered_count: 13,
      correct_count: 13,
      average_score: 3.0
    },
    {
      id: DEMO_MATCHING_QID,
      name: "q_match_concepts",
      question_type: "matching",
      points: 2,
      autograde: "all_or_nothing",
      which_to_grade: "best_answer",
      answered_count: 16,
      correct_count: 9,
      average_score: 1.3
    },
    {
      id: DEMO_WEBWORK_QID,
      name: "q_calc_webwork",
      question_type: "webwork",
      points: 2,
      autograde: "all_or_nothing",
      which_to_grade: "best_answer",
      answered_count: 8,
      correct_count: 5,
      average_score: 1.4
    }
  ]
};

const firstNames = [
  "Alex", "Bob", "Carmen", "Dana", "Elena", "Felix", "Grace", "Hassan",
  "Ivy", "Jin", "Kai", "Lola", "Maxim", "Nina", "Oleg", "Pia",
  "Quentin", "Rita", "Sergey", "Tara"
];
const lastNames = [
  "Kowalski", "Müller", "Rossi", "Dupont", "Svensson", "Jones", "Reyes", "Khan",
  "Singh", "ONeil", "Ng", "Petrov", "Tanaka", "Hernández", "Lind", "Ahmadi",
  "Wójcik", "Silva", "Haddad", "Park"
];

const mchoiceAnswer = (i: number) => {
  const choices = ["0", "1", "2", "3"];
  return choices[i % choices.length];
};

export const DEMO_ANSWERS: GraderAnswersResponse = {
  question: {
    id: DEMO_QUESTION_ID,
    name: "q_loops_mchoice",
    question_type: "mchoice",
    htmlsrc: DEMO_MCHOICE_HTMLSRC,
    max_points: 5
  },
  answers: Array.from({ length: 20 }, (_, i): GraderStudentAnswer => {
    const correct = i % 3 !== 2;
    const partial = !correct && i % 5 === 0;
    const attempts = (i % 4) + 1;
    return {
      sid: i === 0 ? DEMO_STUDENT_SID : `demo-student-${i + 1}`,
      first_name: firstNames[i],
      last_name: lastNames[i],
      email: `${firstNames[i].toLowerCase()}@demo.edu`,
      answer: mchoiceAnswer(i),
      correct: correct,
      percent: correct ? 1 : partial ? 0.5 : 0,
      timestamp: iso(new Date(Date.now() - i * 3600_000)),
      attempts,
      score: correct ? 5 : partial ? 3 : i % 2 === 0 ? null : 1,
      comment:
        i === 0
          ? "Nice reasoning! Consider off-by-one cases next time."
          : i === 1
            ? "Partial — rechecked after lab."
            : i % 5 === 0
              ? "Please show your work next submission."
              : null,
      max_points: 5
    };
  })
};

export const DEMO_HISTORY: GraderHistoryResponse = {
  history: [
    {
      id: 1,
      answer: "2",
      correct: false,
      percent: 0,
      timestamp: iso(new Date(Date.now() - 26 * 3600_000)),
      source: "mchoice"
    },
    {
      id: 2,
      answer: "3",
      correct: false,
      percent: 0,
      timestamp: iso(new Date(Date.now() - 20 * 3600_000)),
      source: "mchoice"
    },
    {
      id: 3,
      answer: "1",
      correct: false,
      percent: 0.5,
      timestamp: iso(new Date(Date.now() - 8 * 3600_000)),
      source: "mchoice"
    },
    {
      id: 4,
      answer: "1",
      correct: false,
      percent: 0.5,
      timestamp: iso(new Date(Date.now() - 4 * 3600_000)),
      source: "mchoice"
    },
    {
      id: 5,
      answer: "0",
      correct: true,
      percent: 1,
      timestamp: iso(new Date(Date.now() - 3600_000)),
      source: "mchoice"
    }
  ],
  useinfo: [
    {
      id: 1,
      timestamp: iso(new Date(Date.now() - 26.1 * 3600_000)),
      event: "mChoice",
      act: "answer:2:no"
    },
    {
      id: 2,
      timestamp: iso(new Date(Date.now() - 20.1 * 3600_000)),
      event: "mChoice",
      act: "answer:3:no"
    },
    {
      id: 3,
      timestamp: iso(new Date(Date.now() - 8.1 * 3600_000)),
      event: "mChoice",
      act: "answer:1:partial"
    },
    {
      id: 4,
      timestamp: iso(new Date(Date.now() - 4.1 * 3600_000)),
      event: "mChoice",
      act: "answer:1:partial"
    },
    {
      id: 5,
      timestamp: iso(new Date(Date.now() - 1.1 * 3600_000)),
      event: "mChoice",
      act: "answer:0:correct"
    }
  ]
};

export const getDemoHistoryFor = (sid: string): GraderHistoryResponse => {
  const student = DEMO_ANSWERS.answers.find((a) => a.sid === sid);
  if (!student) return { history: [], useinfo: [] };
  if (sid === DEMO_STUDENT_SID) return DEMO_HISTORY;

  const total = Math.max(1, student.attempts);
  const baseTs = Date.now();
  const distractors = ["1", "2", "3"].filter((v) => v !== student.answer);
  const finalAnswer = student.answer ?? "0";
  const finalCorrect = student.correct ?? false;
  const finalPercent = student.percent ?? (finalCorrect ? 1 : 0);

  const history = Array.from({ length: total }, (_, i) => {
    const isLast = i === total - 1;
    const attemptAnswer = isLast
      ? finalAnswer
      : distractors[i % distractors.length] ?? "1";
    const attemptCorrect = isLast ? finalCorrect : false;
    const attemptPercent = isLast ? finalPercent : i === total - 2 ? 0.5 : 0;
    return {
      id: i + 1,
      answer: attemptAnswer,
      correct: attemptCorrect,
      percent: attemptPercent,
      timestamp: iso(new Date(baseTs - (total - i) * 3 * 3600_000)),
      source: "mchoice"
    };
  });

  const useinfo = history.map((h, i) => ({
    id: i + 1,
    timestamp: h.timestamp,
    event: "mChoice",
    act: `answer:${h.answer}:${
      h.correct ? "correct" : (h.percent ?? 0) > 0 ? "partial" : "no"
    }`
  }));

  return { history, useinfo };
};

export const getDemoQuestionsFor = (
  aid: number
): GraderQuestionsResponse | null => {
  if (aid === DEMO_ASSIGNMENT_ID) return DEMO_QUESTIONS;
  if (aid === DEMO_ALT_ASSIGNMENT_ID) {
    return {
      assignment: {
        id: DEMO_ALT_ASSIGNMENT_ID,
        name: DEMO_ASSIGNMENTS[1].name,
        description: DEMO_ASSIGNMENTS[1].description,
        duedate: DEMO_ASSIGNMENTS[1].duedate,
        points: DEMO_ASSIGNMENTS[1].points
      },
      questions: DEMO_QUESTIONS.questions.slice(0, 6).map((q, i) => ({
        ...q,
        id: q.id + 10_000,
        name: `alt_${q.name}`,
        answered_count: Math.max(0, q.answered_count - 4 - i)
      }))
    };
  }
  if (aid === DEMO_ALT2_ASSIGNMENT_ID) {
    return {
      assignment: {
        id: DEMO_ALT2_ASSIGNMENT_ID,
        name: DEMO_ASSIGNMENTS[2].name,
        description: DEMO_ASSIGNMENTS[2].description,
        duedate: DEMO_ASSIGNMENTS[2].duedate,
        points: DEMO_ASSIGNMENTS[2].points
      },
      questions: DEMO_QUESTIONS.questions.slice(0, 4).map((q) => ({
        ...q,
        id: q.id + 20_000,
        name: `peer_${q.name}`
      }))
    };
  }
  return null;
};

export const getDemoAnswersFor = (
  aid: number,
  qid: number
): GraderAnswersResponse | null => {
  if (aid === DEMO_ASSIGNMENT_ID && qid === DEMO_QUESTION_ID) return DEMO_ANSWERS;
  const qMeta = getDemoQuestionsFor(aid)?.questions.find((q) => q.id === qid);
  if (!qMeta) return null;
  return {
    question: {
      id: qMeta.id,
      name: qMeta.name,
      question_type: qMeta.question_type,
      htmlsrc: qMeta.question_type === "mchoice" ? DEMO_MCHOICE_HTMLSRC : undefined,
      max_points: qMeta.points
    },
    answers: DEMO_ANSWERS.answers.map((a) => ({ ...a, max_points: qMeta.points }))
  };
};

