import { AnswerRendererProps } from "../types";

export type AssociationKind = "matching" | "dragndrop";

export interface AssociationAnswerViewProps extends AnswerRendererProps {
  kind: AssociationKind;
  showQuestionHeader?: boolean;
}

export interface AnswerAssociation {
  from: string;
  to: string;
}

export type AssociationLabels = Record<string, string>;
