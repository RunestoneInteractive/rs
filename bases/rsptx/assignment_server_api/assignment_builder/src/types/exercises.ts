export type Exercise = {
  id: number;
  assignment_id: number;
  question_id: number;
  points: number;
  timed: boolean;
  autograde: string;
  which_to_grade: string;
  reading_assignment: null;
  sorting_priority: number;
  activities_required: null;
  qnumber: string;
  name: string;
  subchapter: string;
  chapter: string;
  base_course: string;
  htmlsrc: string;
  question_type: string;
  question_json: {
    statement: string;
    attachment: boolean;
  };
  owner: string;
  tags: string;
};

export type GetExercisesResponse = {
  exercises: Exercise[];
};

export type GetExercisesPayload = {
  assignment: number;
};

export type UpdateAssignmentExercisePayload = {
  id: number;
  base_course: string;
  name: string;
  chapter: string;
  subchapter: string;
  author: string;
  question: string;
  timestamp: string;
  question_type: string;
  is_private: boolean;
  htmlsrc: string;
  autograde: string;
  practice: null;
  topic: string;
  feedback: null;
  from_source: boolean;
  review_flag: boolean;
  qnumber: string;
  optional: boolean;
  description: string;
  difficulty: number;
  pct_on_first: null;
  mean_clicks_to_correct: null;
  question_json: null;
  owner: null;
  tags: null;
  assignment_id: number;
  question_id: number;
  points: number;
  which_to_grade: string;
  sorting_priority: number;
  reading_assignment: boolean;
};

export type SearchExercisePayload = {
  author: string;
  base_course: boolean;
  question_type: string;
  source_regex: string;
};

export type SearchExercisesResponse = {
  questions: Exercise[];
};
