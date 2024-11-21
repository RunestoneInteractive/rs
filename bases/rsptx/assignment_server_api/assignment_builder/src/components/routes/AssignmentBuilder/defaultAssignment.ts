import { CreateAssignmentPayload } from "@/types/assignment";

export const defaultAssignment: CreateAssignmentPayload = {
  name: "",
  description: "",
  duedate: new Date().toISOString().replace("Z", ""),
  points: 0,
  kind: "quickcode"
};
