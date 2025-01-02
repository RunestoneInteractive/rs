import { CreateAssignmentPayload } from "@/types/assignment";
import { convertDateToISO } from "@/utils/date";

export const defaultAssignment: CreateAssignmentPayload = {
  name: "",
  description: "",
  duedate: convertDateToISO(new Date()),
  points: 0,
  kind: "Regular"
};
