import { AnswerAssociation, AssociationKind } from "../types";

import { parseJsonObject } from "./parseJsonObject";

export const parseAssociations = (kind: AssociationKind, answer: string): AnswerAssociation[] => {
  const parsed = parseJsonObject(answer);

  if (!parsed) return [];

  if (kind === "matching") {
    const connections = Array.isArray(parsed.connections) ? parsed.connections : [];

    return connections.flatMap((connection) => {
      if (!connection || typeof connection !== "object") return [];
      const { from, to } = connection as Record<string, unknown>;

      return typeof from === "string" && typeof to === "string" ? [{ from, to }] : [];
    });
  }

  return Object.entries(parsed).flatMap(([dropzone, items]) =>
    Array.isArray(items)
      ? items
          .filter((item): item is string => typeof item === "string")
          .map((item) => ({ from: item, to: dropzone }))
      : []
  );
};
