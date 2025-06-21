import { assignmentActions } from "@store/assignment/assignment.logic";
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery,
  useUpdateAssignmentMutation
} from "@store/assignment/assignment.logic.api";
import sortBy from "lodash/sortBy";
import { toast } from "react-hot-toast";
import { useDispatch } from "react-redux";

import { Assignment } from "@/types/assignment";

import { Loader } from "../../../ui/Loader";
import { useAssignmentState } from "../hooks/useAssignmentState";

import { AssignmentBuilderLayout } from "./AssignmentBuilderLayout";
import { AssignmentList } from "./list/AssignmentList";

export const AssignmentBuilderList = () => {
  const dispatch = useDispatch();
  const { isLoading, isError, data: assignments = [] } = useGetAssignmentsQuery();
  const [createAssignment] = useCreateAssignmentMutation();
  const [updateAssignment] = useUpdateAssignmentMutation();

  const { globalFilter, setGlobalFilter } = useAssignmentState();

  const handleCreateNew = () => {
    window.location.href = "/builder/create";
  };

  const handleEdit = (assignment: Assignment) => {
    dispatch(assignmentActions.setSelectedAssignmentId(assignment.id));
    window.location.href = `/builder/${assignment.id}`;
  };

  const handleVisibilityChange = async (assignment: Assignment, visible: boolean) => {
    try {
      await updateAssignment({
        ...assignment,
        visible
      });
      toast.success(`Assignment ${visible ? "visible" : "hidden"} for students`);
    } catch (error) {
      toast.error("Failed to update assignment visibility");
    }
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
      <AssignmentList
        assignments={sortBy(assignments, (x) => x.id)}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onDuplicate={createAssignment}
        onVisibilityChange={handleVisibilityChange}
      />
    </AssignmentBuilderLayout>
  );
};
