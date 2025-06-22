import { CreateAssignmentPayload } from "@/types/assignment";
import { convertDateToISO } from "@/utils/date";

export const defaultAssignment: CreateAssignmentPayload = {
  name: "",
  description: "",
  duedate: convertDateToISO(new Date()),
  points: 0,
  kind: "Regular",
  time_limit: 60,
  nofeedback: false,
  nopause: false,
  peer_async_visible: false,
  visible: false
};
