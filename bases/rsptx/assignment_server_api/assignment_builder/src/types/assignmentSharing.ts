/** Types for browsing and importing assignments shared by other courses. */

export type SharedAssignmentQuestion = {
  id: number;
  name: string;
  question_type: string | null;
  points: number;
  chapter: string | null;
  subchapter: string | null;
  reading_assignment: boolean | null;
  /** False for a reading that cannot follow the assignment into your book. */
  will_import: boolean;
};

export type SharedAssignmentPreview = {
  id: number;
  name: string;
  description: string | null;
  points: number;
  kind: string | null;
  /** Already shifted to the importing course's term. */
  duedate: string;
  question_count: number;
  course_name: string;
  base_course: string;
  book_title: string;
  institution: string | null;
  /** True for an assignment the book itself ships, on its base course row. */
  is_official: boolean;
  sharing_description: string;
  /** True when this assignment belongs to a different book than your course. */
  is_cross_book: boolean;
  /** True when a copy is already in your course. */
  already_imported: boolean;
  /** Name that copy goes by, which may have been renamed since. */
  imported_as: string | null;
  /** How many readings will be left behind, which only happens cross-book. */
  skipped_readings: number;
  questions: SharedAssignmentQuestion[];
};

export type ImportAssignmentResult = {
  status: string;
  id: number;
  name: string;
  skipped_readings: number;
};

/** One assignment under a course in the import tree. */
export type ShareableTreeAssignment = {
  id: number;
  name: string;
  description: string | null;
  points: number;
  kind: string | null;
  question_count: number;
  /** True for an assignment the book itself ships. */
  is_official: boolean;
  /** True when a copy is already in the requester's course. */
  already_imported: boolean;
  /** Name that copy goes by, which may have been renamed since. */
  imported_as: string | null;
};

/** A course in the import tree, with everything it offers. */
export type ShareableTreeCourse = {
  id: number;
  course_name: string;
  institution: string | null;
  base_course: string;
  book_title: string;
  /** How many assignments this course offers, before any are expanded. */
  shareable_count: number;
  /** True when this course is a book's own course. */
  is_official: boolean;
  /** True when the requester instructs this course. */
  is_mine: boolean;
  assignments: ShareableTreeAssignment[];
};

export type ShareableTreeResponse = {
  courses: ShareableTreeCourse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

export type ShareableTreeRequest = {
  search: string;
  /** When true, only courses on the caller's own book. */
  use_base_course: boolean;
  only_my_courses: boolean;
  page: number;
  limit: number;
};

export type ImportCourseResult = {
  status: string;
  imported: string[];
  skipped_existing: string[];
  skipped_readings: number;
  failed: string[];
};
