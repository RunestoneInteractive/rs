import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ActionType } from "typesafe-actions";

export interface AssignmentState {
  id: number;
  name: string;
  description: string;
  duedate: string;
  points: number;
  visible: boolean;
  is_peer: boolean;
  is_timed: boolean;
  nofeedback: boolean;
  nopause: boolean;
  time_limit: number | null;
  peer_async_visible: boolean;
  kind: "Regular" | "Peer" | "Timed";
  exercises: [];
  all_assignments: [];
  search_results: [];
  question_count: number;
  isAuthorized: boolean;
  released: boolean;
  selectedAssignments: [];
  course: number;
  threshold_pct: null;
  allow_self_autograde: null;
  from_source: boolean;
  current_index: number;
  enforce_due: null;
}

const INITIAL_STATE: AssignmentState = {
  id: 0,
  name: "",
  description: "",
  duedate: new Date().toLocaleString(),
  points: 1,
  visible: true,
  is_peer: false,
  is_timed: false,
  nofeedback: true,
  nopause: true,
  time_limit: null,
  peer_async_visible: false,
  kind: "Regular", // (regular, peer, timed)
  exercises: [],
  all_assignments: [],
  search_results: [],
  question_count: 0,
  isAuthorized: true,
  released: false,
  selectedAssignments: [],
  course: 0,
  threshold_pct: null,
  allow_self_autograde: null,
  from_source: false,
  current_index: 0,
  enforce_due: null
};

export const assignmentSlice = createSlice({
  name: "assignment",
  initialState: INITIAL_STATE,
  reducers: {
    setId: (state, action: PayloadAction<number>) => {
      state.id = action.payload;
    }
  }
});

export const assignmentActions = assignmentSlice.actions;

export type AssignmentActions = ActionType<typeof assignmentActions>;
