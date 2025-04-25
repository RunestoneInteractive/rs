import { assignmentSelectors } from "@store/assignment/assignment.logic";
import {
  useGetAssignmentQuery,
  useUpdateAssignmentMutation
} from "@store/assignment/assignment.logic.api";
import { useCallback, useRef } from "react";
import { useSelector } from "react-redux";

import { Assignment } from "@/types/assignment";

export const useSelectedAssignment = () => {
  const selectedAssignmentId = useSelector(assignmentSelectors.getSelectedAssignmentId);
  const { data: selectedAssignment } = useGetAssignmentQuery(selectedAssignmentId as number, {
    skip: !selectedAssignmentId
  });
  const [putAssignment] = useUpdateAssignmentMutation();

  const selectedAssignmentRef = useRef(selectedAssignment);
  const selectedAssignmentIdRef = useRef(selectedAssignmentId);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  selectedAssignmentRef.current = selectedAssignment;
  selectedAssignmentIdRef.current = selectedAssignmentId;

  const updateAssignment = useCallback(
    (updateData: Partial<Assignment>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (selectedAssignmentIdRef.current && selectedAssignmentRef.current) {
          const updatedAssignment = {
            ...selectedAssignmentRef.current,
            ...updateData
          };

          putAssignment(updatedAssignment);
        }
      }, 500);
    },
    [putAssignment]
  );

  return {
    selectedAssignment,
    updateAssignment
  };
};
