import { FilterMatchMode } from "primereact/api";

export const supportedExerciseTypesToEdit = [
  "mchoice",
  "poll",
  "shortanswer",
  "activecode",
  "dragndrop",
  "parsonsprob"
];

export const supportedExerciseTypes = [
  "mchoice",
  "parsonsprob",
  "activecode",
  "fillintheblank",
  "dragndrop",
  "clickablearea",
  "poll",
  "shortanswer"
] as const;

export type ExerciseType = (typeof supportedExerciseTypes)[number];

export interface Option {
  choice: string;
  feedback?: string;
  correct?: boolean;
}

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
  description: string;
};

export type QuestionJSON = Partial<{
  prefix_code: string;
  starter_code: string;
  suffix_code: string;
  instructions: string;
  language: string;
  attachment: boolean;
  statement: string;
  optionList: Option[];
  leftColumnBlocks: { id: string; content: string }[];
  rightColumnBlocks: { id: string; content: string }[];
  connections: { id: string; sourceId: string; targetId: string }[];
}>;

export type CreateExerciseFormType = Omit<Exercise, "question_json"> & QuestionJSON;

export type GetExercisesResponse = {
  exercises: Exercise[];
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

export const isExerciseType = (value: any): value is ExerciseType => {
  return supportedExerciseTypesToEdit.includes(value);
};

export type UpdateAssignmentExercisePayload = Exercise;

export type UpdateAssignmentExercisesPayload =
  | { isReading: boolean; assignmentId: number; idsToAdd: number[]; idsToRemove?: never }
  | { isReading: boolean; assignmentId: number; idsToRemove: number[]; idsToAdd?: never }
  | { isReading: boolean; assignmentId: number; idsToAdd: number[]; idsToRemove: number[] };

// Define filter value structure
export type FilterValue = {
  value: string | number | boolean | string[] | any[];
  mode: FilterMatchMode;
};

// Improved types for smart exercise search
export type ExercisesSearchRequest = {
  // Base course handling
  use_base_course: boolean;

  // Assignment ID to filter out already assigned exercises
  assignment_id?: number;

  // Pagination
  page: number;
  limit: number;

  // Sorting
  sorting: {
    field: string;
    order: number; // 1 for ascending, -1 for descending
  };

  // Filters with explicit modes instead of pattern matching
  filters: Record<string, FilterValue | FilterValue[] | null>;
};

export type PaginationMetadata = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type ExercisesSearchResponse = {
  exercises: Exercise[];
  pagination: PaginationMetadata;
};
