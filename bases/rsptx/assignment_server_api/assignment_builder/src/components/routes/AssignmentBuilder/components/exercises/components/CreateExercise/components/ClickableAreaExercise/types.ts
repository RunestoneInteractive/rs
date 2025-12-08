// Types for Clickable Area exercise

export interface ClickableArea {
  id: string;
  type: "correct" | "incorrect";
  from: number;
  to: number;
  text: string;
}

export interface ClickableAreaData {
  statement: string;
  feedback: string;
  areas: ClickableArea[];
}
