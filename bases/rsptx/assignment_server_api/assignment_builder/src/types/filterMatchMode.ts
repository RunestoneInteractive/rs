export const FilterMatchMode = {
  CONTAINS: "contains",
  NOT_CONTAINS: "notContains",
  STARTS_WITH: "startsWith",
  ENDS_WITH: "endsWith",
  EQUALS: "equals",
  NOT_EQUALS: "notEquals",
  IN: "in"
} as const;

export type FilterMatchMode = (typeof FilterMatchMode)[keyof typeof FilterMatchMode];
