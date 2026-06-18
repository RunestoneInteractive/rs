export interface AssignmentKind {
  kind: "Regular" | "Timed" | "Peer";
  cardLabel: RegExp;
  settingsProbe: string;
  editSectionHeading: string | null;
}

export const assignmentKinds: AssignmentKind[] = [
  {
    kind: "Regular",
    cardLabel: /Regular/,
    settingsProbe: "No additional options",
    editSectionHeading: null
  },
  {
    kind: "Timed",
    cardLabel: /Quiz\/Exam/,
    settingsProbe: "Allow pause",
    editSectionHeading: "Behavior"
  },
  {
    kind: "Peer",
    cardLabel: /Peer/,
    settingsProbe: "Show async peer",
    editSectionHeading: "Peer settings"
  }
];
