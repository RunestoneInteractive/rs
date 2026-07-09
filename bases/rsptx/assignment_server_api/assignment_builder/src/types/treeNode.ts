export type SelectedKey = { checked: boolean; partialChecked: boolean };

export interface TreeNode {
  key?: string | number;
  label?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  children?: TreeNode[];
  leaf?: boolean;
  selectable?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  className?: string;
  style?: object;
}
