export type GetAvailableReadingsPayload = {
  from_source_only: boolean;
  pages_only: boolean;
  skipreading: boolean;
};

export type UpdateAssignmentReadingPayload = {
  assignment_id: number;
  question_id: number;
  points: number;
  sorting_priority: number;
  reading_assignment: true;
  autograde: "interaction";
  which_to_grade: "best_answer";
  activities_required: number;
  required: boolean;
};
