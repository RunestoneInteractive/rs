import { assignmentSelectors } from "@store/assignment/assignment.logic";
import {
  useGetAssignmentQuery,
  useUpdateAssignmentMutation
} from "@store/assignment/assignment.logic.api";
import { useCallback, useRef } from "react";
import { useSelector } from "react-redux";

export const useSelectedAssignment = () => {
  const selectedAssignmentId = useSelector(assignmentSelectors.getSelectedAssignmentId);
  const { data: selectedAssignment } = useGetAssignmentQuery(selectedAssignmentId as number, {
    skip: !selectedAssignmentId
  });
  const [putAssignment] = useUpdateAssignmentMutation();

  const selectedAssignmentRef = useRef(selectedAssignment);
  const selectedAssignmentIdRef = useRef(selectedAssignmentId);

  selectedAssignmentRef.current = selectedAssignment;
  selectedAssignmentIdRef.current = selectedAssignmentId;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateAssignment = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null;

      return (updateData: any) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          if (selectedAssignmentIdRef.current) {
            putAssignment({
              id: selectedAssignmentIdRef.current,
              ...updateData
            });
          }
        }, 500);
      };
    })(),
    [putAssignment]
  );

  return {
    selectedAssignment,
    updateAssignment
  };
};
