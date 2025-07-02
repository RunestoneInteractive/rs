import { assignmentActions } from "@store/assignment/assignment.logic";
import { useGetAssignmentsQuery } from "@store/assignment/assignment.logic.api";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useParams } from "react-router-dom";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";

import { Loader } from "../../../ui/Loader";
import { useAssignmentForm } from "../hooks/useAssignmentForm";
import { useAssignmentState } from "../hooks/useAssignmentState";

import { AssignmentBuilderLayout } from "./AssignmentBuilderLayout";
import { AssignmentEdit } from "./edit/AssignmentEdit";

export const AssignmentBuilderEdit = () => {
  const dispatch = useDispatch();
  const { assignmentId, tab } = useParams<{ assignmentId: string; tab?: string }>();
  const { isLoading, isError } = useGetAssignmentsQuery();

  const { selectedAssignment, updateAssignment: updateSelectedAssignment } =
    useSelectedAssignment();

  useEffect(() => {
    if (assignmentId && assignmentId !== selectedAssignment?.id?.toString()) {
      dispatch(assignmentActions.setSelectedAssignmentId(parseInt(assignmentId, 10)));
    }
  }, [assignmentId, selectedAssignment?.id, dispatch]);

  const { isCollapsed, setIsCollapsed, handleTypeSelect } = useAssignmentState();

  const { control, watch, setValue } = useAssignmentForm({
    selectedAssignment: selectedAssignment || null,
    mode: "edit",
    onAssignmentUpdate: updateSelectedAssignment
  });

  const activeTab = (tab as "basic" | "readings" | "exercises") || "basic";

  const handleBack = () => {
    window.location.href = "/builder";
  };

  const handleTabChange = (newTab: "basic" | "readings" | "exercises") => {
    window.location.href = `/builder/${assignmentId}/${newTab}`;
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
      <AssignmentEdit
        control={control}
        selectedAssignment={selectedAssignment || null}
        isCollapsed={isCollapsed}
        activeTab={activeTab}
        onCollapse={() => setIsCollapsed(!isCollapsed)}
        onBack={handleBack}
        onTabChange={handleTabChange}
        onTypeSelect={(type) => handleTypeSelect(type, setValue)}
        watch={watch}
        setValue={setValue}
      />
    </AssignmentBuilderLayout>
  );
};
