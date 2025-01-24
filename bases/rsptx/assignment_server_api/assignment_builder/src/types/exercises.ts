import { Choice } from "@/types/createExerciseForm";

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
  question_json: string;
  owner: string;
  tags: string;
  num: number;
  numQuestions: number;
  required: boolean;
  title: string;
  topic: string;
  difficulty: number;
  author: string;
};

export type QuestionJSON = Partial<{
  prefix_code: string;
  starter_code: string;
  suffix_code: string;
  instructions: string;
  language: string;
  attachment: boolean;
  statement: string;
  optionList: Choice[];
}>;

export type CreateExerciseFormType = Omit<Exercise, "question_json"> & QuestionJSON;

export type GetExercisesResponse = {
  exercises: Exercise[];
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

export type CreateExercisesPayload = {
  author: string;
  autograde: null;
  chapter: string;
  difficulty: number;
  htmlsrc: string;
  name: string;
  question_json: string;
  question_type: string;
  source: "This question was written in the web interface";
  tags: string;
  topic: string;
  points: number;
};

export const supportedExerciseTypesToEdit = ["activecode", "mchoice", "shortanswer"] as const;

export type ExerciseType = (typeof supportedExerciseTypesToEdit)[number];

export const isExerciseType = (value: any): value is ExerciseType => {
  return supportedExerciseTypesToEdit.includes(value);
};

export type UpdateAssignmentExercisePayload = Exercise;

export type UpdateAssignmentExercisesPayload =
  | { isReading: boolean; assignmentId: number; idsToAdd: number[]; idsToRemove?: never }
  | { isReading: boolean; assignmentId: number; idsToRemove: number[]; idsToAdd?: never }
  | { isReading: boolean; assignmentId: number; idsToAdd: number[]; idsToRemove: number[] };
