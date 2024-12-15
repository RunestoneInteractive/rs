export type KindOfAssignment = "Regular" | "Peer" | "Timed";

export type Assignment = {
  id: number;
  name: string;
  description: string;
  duedate: string;
  points: number;
  visible: boolean;
  is_peer: boolean;
  is_timed: boolean;
  nofeedback: boolean;
  nopause: boolean;
  time_limit: number | null;
  peer_async_visible: boolean;
  kind: KindOfAssignment;
  exercises: [];
  all_assignments: [];
  search_results: [];
  question_count: number;
  isAuthorized: boolean;
  released: boolean;
  selectedAssignments: [];
  course: number;
  threshold_pct: null;
  allow_self_autograde: null;
  from_source: boolean;
  current_index: number;
  enforce_due: null;
};

export type CreateAssignmentPayload = {
  name: string;
  description: string;
  duedate: string;
  points: number;
  kind: "Regular";
};

export type CreateAssignmentValidationResponse = [
  {
    type: string;
    loc: string[];
    msg: string;
  }
];

export type GetAssignmentsResponse = {
  assignments: Assignment[];
};

export type CreateAssignmentExercisePayload = {
  assignment_id: number;
  autograde: null;
  id: number;
  points: number;
  qnumber: string;
  question_id: number;
  which_to_grade: "best_answer";
};
