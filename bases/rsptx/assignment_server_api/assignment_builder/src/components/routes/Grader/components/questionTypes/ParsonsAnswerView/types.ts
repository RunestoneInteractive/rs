export interface ParsonsHashBlock {
  lineIndexes: number[];
  indent: number;
}

export interface ParsonsSourceLine {
  indentLevel: number;
  text: string;
}

export interface ParsonsSource {
  indentUnit: string;
  lines: ParsonsSourceLine[];
  noIndent: boolean;
}
