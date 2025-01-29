export const dropdownFields = ["autograde", "which_to_grade"] as const;
export const numberFields = ["points"] as const;

export type DraggingExerciseDropdownColumns = (typeof dropdownFields)[number];
export type DraggingExerciseNumberColumns = (typeof numberFields)[number];

export type DraggingExerciseColumns =
  | DraggingExerciseNumberColumns
  | DraggingExerciseDropdownColumns;

export const isDropdownField = (
  fieldName: DraggingExerciseColumns
): fieldName is DraggingExerciseDropdownColumns => {
  return dropdownFields.includes(fieldName as DraggingExerciseDropdownColumns);
};

export const isNumberField = (
  fieldName: DraggingExerciseColumns
): fieldName is DraggingExerciseNumberColumns => {
  return numberFields.includes(fieldName as DraggingExerciseNumberColumns);
};

export type EditableCellProps<
  TFieldName extends string = DraggingExerciseColumns,
  TFieldValue = string | number
> = {
  fieldName: TFieldName;
  rowIndex: number;
  handleChange: (rowIndex: number, fieldName: TFieldName, value: TFieldValue) => void;
  hideDragIcon: VoidFunction;
  value: TFieldValue;
  questionType: string;
};

export type EditableCellFactoryProps<
  TFieldName extends string = DraggingExerciseColumns,
  TFieldValue = string | number
> = {
  fieldName: TFieldName;
  rowIndex: number;
  handleMouseDown: (rowIndex: number, fieldName: TFieldName) => void;
  handleChange: (rowIndex: number, fieldName: TFieldName, value: TFieldValue) => void;
  value: TFieldValue;
  questionType: string;
  isDragging: boolean;
};
