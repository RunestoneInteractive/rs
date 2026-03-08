import { CreateAssignmentPayload } from "@/types/assignment";
import { convertDateToLocalISO } from "@/utils/date";

export const defaultAssignment: CreateAssignmentPayload = {
  name: "",
  description: "",
  duedate: convertDateToLocalISO(new Date()),
  points: 0,
  kind: "Regular",
  time_limit: null,
  nofeedback: false,
  nopause: false,
  peer_async_visible: false,
  visible: false,
  visible_on: null,
  hidden_on: null,
  released: true,
  enforce_due: false
};
