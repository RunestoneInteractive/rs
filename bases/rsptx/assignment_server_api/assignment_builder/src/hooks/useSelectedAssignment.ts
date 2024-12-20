import { assignmentActions, assignmentSelectors } from "@store/assignment/assignment.logic";
import { useDispatch, useSelector } from "react-redux";

import { Assignment } from "@/types/assignment";

export const useSelectedAssignment = () => {
  const dispatch = useDispatch();
  const selectedAssignment = useSelector(assignmentSelectors.getSelectedAssignment);

  const updateAssignment = (updatedFields: Partial<Assignment>) => {
    if (!!selectedAssignment) {
      dispatch(
        assignmentActions.setSelectedAssignment({
          ...selectedAssignment,
          ...updatedFields
        })
      );
    }
  };

  return {
    selectedAssignment,
    updateAssignment
  };
};
