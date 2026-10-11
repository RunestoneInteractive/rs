import { AssociationKind } from "../types";

import { parseAssociationLabels } from "./parseAssociationLabels";
import { parseAssociations } from "./parseAssociations";

export const formatAssociationAnswer = (
  kind: AssociationKind,
  answer: string,
  htmlsrc?: string
): string => {
  const labels = parseAssociationLabels(htmlsrc);

  return parseAssociations(kind, answer)
    .map(({ from, to }) => `${labels[from] || from} → ${labels[to] || to}`)
    .join("; ");
};
