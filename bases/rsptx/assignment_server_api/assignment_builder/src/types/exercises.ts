export type Exercise = {
  id: number;
  assignment_id: number;
  question_id: number;
  points: number;
  timed: boolean;
  autograde: string;
  which_to_grade: string;
  reading_assignment: boolean;
  sorting_priority: number;
  activities_required: number;
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
  num: number;
  numQuestions: number;
  required: boolean;
  title: string;
};

export type GetExercisesResponse = {
  exercises: Exercise[];
};

export type GetExercisesPayload = {
  assignment: number;
};

export type SearchExercisePayload = {
  author: string;
  // TODO: Change endpoint to get boolean instead of string: RUN-15
  base_course: "true" | "false";
  question_type: string;
  source_regex: string;
};

export type SearchExercisesResponse = {
  questions: Exercise[];
};

export type ExerciseType = "activecode" | "mchoice" | "shortanswer";

export type CreateExercisesPayload = {
  author: string;
  autograde: null;
  chapter: string;
  difficulty: number;
  htmlsrc: string;
  name: string;
  question_json: string;
  question_type: ExerciseType;
  source: "This question was written in the web interface";
  tags: string;
  topic: string;
  points: number;
};

export type UpdateAssignmentReadingPayload = {
  assignment_id: number;
  points: number;
  sorting_priority: number;
  reading_assignment: boolean;
  autograde: string;
  which_to_grade: string;
  activities_required: number;
  required: boolean;
  chapter: string;
  id: number;
  num: number;
  numQuestions: number;
  subchapter: string;
  title: string;
  question_id: number;
};

export type UpdateAssignmentQuestionPayload = UpdateAssignmentReadingPayload & {
  author: string;
  base_course: string;
  description: string;
  difficulty: number;
  feedback: any;
  from_source: boolean;
  htmlsrc: string;
  is_private: boolean;
  mean_clicks_to_correct: any;
  name: string;
  optional: boolean;
  owner: any;
  pct_on_first: any;
  practice: boolean;
  qnumber: string;
  question_json: any;
  question_type: string;
  review_flag: boolean;
  tags: string;
  topic: string;
};

export type UpdateAssignmentExercisePayload =
  | UpdateAssignmentReadingPayload
  | UpdateAssignmentQuestionPayload;
