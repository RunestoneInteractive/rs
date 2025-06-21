import { assignmentActions } from "@store/assignment/assignment.logic";
import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useParams } from "react-router-dom";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";

import { Loader } from "../../../ui/Loader";
import { useAssignmentState } from "../hooks/useAssignmentState";

import { AssignmentBuilderLayout } from "./AssignmentBuilderLayout";
import { AssignmentExercises } from "./exercises/AssignmentExercisesList";

export const AssignmentBuilderExercises = () => {
  const dispatch = useDispatch();
  const { assignmentId, viewMode, exerciseType, exerciseSubType, step, exerciseId } = useParams<{
    assignmentId: string;
    viewMode: string;
    exerciseType?: string;
    exerciseSubType?: string;
    step?: string;
    exerciseId?: string;
  }>();

  const { isLoading, isError } = useGetAssignmentsQuery();

  // Get selected assignment from routing
  const { selectedAssignment } = useSelectedAssignment();

  // Update selected assignment ID in store when route changes
  useEffect(() => {
    if (assignmentId && assignmentId !== selectedAssignment?.id?.toString()) {
      dispatch(assignmentActions.setSelectedAssignmentId(parseInt(assignmentId, 10)));
    }
  }, [assignmentId, selectedAssignment?.id, dispatch]);

  const { isCollapsed, setIsCollapsed } = useAssignmentState();

  const handleBack = () => {
    window.location.href = `/builder/${assignmentId}`;
  };

  if (isLoading) {
    return (
      <div className="flex center">
        <Loader />
      </div>
    );
  }

  if (isError) {
    return <div>Error loading assignments!</div>;
  }

  return (
    <AssignmentBuilderLayout>
      <AssignmentExercises />
    </AssignmentBuilderLayout>
  );
};
