export type DraggingExerciseColumns =
  | "autograde"
  | "which_to_grade"
  | "points"
  | "activities_required";
export type DraggingExerciseDropdownColumns = "autograde" | "which_to_grade";
export type DraggingExerciseNumberColumns = "points" | "activities_required";

export const isDropdownField = (
  field: DraggingExerciseColumns
): field is DraggingExerciseDropdownColumns => {
  return ["autograde", "which_to_grade"].includes(field);
};

export const isNumberField = (
  field: DraggingExerciseColumns
): field is DraggingExerciseNumberColumns => {
  return ["points", "activities_required"].includes(field);
};

export type EditableCellProps<
  TFieldName extends string = DraggingExerciseColumns,
  TFieldValue = string | number
> = {
  fieldName: TFieldName;
  itemId: number;
  handleChange: (itemId: number, fieldName: TFieldName, value: TFieldValue) => void;
  hideDragIcon: VoidFunction;
  value: TFieldValue;
  questionType: string;
};

export type EditableCellFactoryProps<
  TFieldName extends string = DraggingExerciseColumns,
  TFieldValue = string | number
> = {
  fieldName: TFieldName;
  itemId: number;
  handleMouseDown: (itemId: number, fieldName: TFieldName) => void;
  handleChange: (itemId: number, fieldName: TFieldName, value: TFieldValue) => void;
  value: TFieldValue;
  questionType: string;
  isDragging: boolean;
};
