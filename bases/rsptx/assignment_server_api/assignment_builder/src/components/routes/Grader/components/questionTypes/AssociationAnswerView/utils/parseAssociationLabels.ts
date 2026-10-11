import { AssociationLabels } from "../types";

import { textOnly } from "./textOnly";

export const parseAssociationLabels = (htmlsrc?: string): AssociationLabels => {
  if (!htmlsrc) return {};

  const documentFragment = new DOMParser().parseFromString(htmlsrc, "text/html");
  const labels: AssociationLabels = {};
  const jsonScript = documentFragment.querySelector('script[type="application/json"]');

  if (jsonScript?.textContent) {
    try {
      const question = JSON.parse(jsonScript.textContent) as Record<string, unknown>;

      for (const side of [question.left, question.right]) {
        if (!Array.isArray(side)) continue;
        for (const item of side) {
          if (!item || typeof item !== "object") continue;
          const { id, label } = item as Record<string, unknown>;

          if (typeof id === "string" && typeof label === "string") {
            labels[id] = textOnly(label);
          }
        }
      }
    } catch {
      // Legacy markup below can still provide useful labels.
    }
  }

  for (const element of documentFragment.querySelectorAll<HTMLElement>(
    '[data-subcomponent="draggable"], [data-subcomponent="dropzone"]'
  )) {
    if (element.id) labels[element.id] = element.textContent?.trim() || element.id;
  }

  return labels;
};
