import { AutoComplete } from "@components/ui/AutoComplete";
import { Loader } from "@components/ui/Loader";
import { assignmentActions } from "@store/assignment/assignment.logic";
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery
} from "@store/assignment/assignment.logic.api";
import { InputSwitch } from "primereact/inputswitch";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";

import { AssignmentViewSelect } from "./components/AssignmentViewSelect";
import { defaultAssignment } from "./defaultAssignment";

export const AssignmentBuilder = () => {
  const dispatch = useDispatch();
  const {
    isLoading,
    isError,
    data: assignments,
    refetch: refetchAssignments
  } = useGetAssignmentsQuery();
  const [createAssignment] = useCreateAssignmentMutation();
  const [selectedAssignmentName, setSelectedAssignmentName] = useState<string | undefined>();
  const { selectedAssignment, updateAssignment } = useSelectedAssignment();

  useEffect(() => {
    dispatch(
      assignmentActions.setSelectedAssignment(
        assignments?.find((a) => a.name === selectedAssignmentName)
      )
    );
  }, [assignments, dispatch, selectedAssignmentName]);

  useEffect(() => {
    refetchAssignments();
  }, [refetchAssignments, selectedAssignmentName]);

  if (isLoading) {
    return (
      <div className="flex center">
        <Loader />
      </div>
    );
  }

  if (isError || !assignments) {
    return <div>Error!</div>;
  }

  const createNewOption = "Create New";

  const onAssignmentSelect = ({ value }: { value: string }) => {
    setSelectedAssignmentName(value);
    const assignmentFromList = assignments.find((a) => a.name === value);

    if (!assignmentFromList) {
      createAssignment({ ...defaultAssignment, name: value });
    } else {
      dispatch(assignmentActions.setSelectedAssignment(assignmentFromList));
    }
  };

  return (
    <div className="col-12" style={{ minWidth: "500px" }}>
      <div className="card">
        <h3>Assignment Builder</h3>
        <div className="p-fluid formgrid grid">
          <div className={`field col-12 md:col-${selectedAssignment ? 9 : 12}`}>
            <label htmlFor="name">Assignment Name</label>
            <AutoComplete
              className="field"
              id="name"
              suggestions={assignments.map((assignment) => assignment.name)}
              placeholder="Enter or select assignment name... start typing"
              defaultOption={createNewOption}
              onSelect={onAssignmentSelect}
            />
          </div>
          {selectedAssignment && (
            <>
              <div style={{ paddingTop: "0.5rem" }} className="field col-12 md:col-3  flex">
                <div className="flex align-items-center flex-shrink-1 gap-1">
                  <label className="label mb-0" htmlFor="visibleToStudents">
                    Visible to Students
                  </label>
                  <InputSwitch
                    className="flex-shrink-0"
                    id="visibleToStudents"
                    checked={selectedAssignment.visible}
                    onChange={({ value }) => updateAssignment({ visible: value })}
                  />
                </div>
              </div>
              <AssignmentViewSelect />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
