import { AssignmentMainForm } from "@components/routes/AssignmentBuilder/components/AssignmentMainForm";
import { defaultAssignment } from "@components/routes/AssignmentBuilder/defaultAssignment";
import { AutoComplete } from "@components/ui/AutoComplete";
import { Loader } from "@components/ui/Loader";
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery
} from "@store/assignment/assignmentLogic.api";
import { useEffect, useState } from "react";

import { Assignment } from "@/types/assignment";

export const AssignmentBuilder = () => {
  const { isLoading, isError, data: assignments } = useGetAssignmentsQuery();
  const [createAssignment, sss] = useCreateAssignmentMutation();
  const [selectedAssignmentName, setSelectedAssignmentName] = useState<string | undefined>();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | undefined>();

  useEffect(() => {
    setSelectedAssignment(assignments?.find((a) => a.name === selectedAssignmentName));
  }, [assignments, selectedAssignmentName]);

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
    console.log(value);
    const assignmentFromList = assignments.find((a) => a.name === value);

    if (!assignmentFromList) {
      createAssignment({ ...defaultAssignment, name: value });
    }
  };

  return (
    <div className="col-12" style={{ minWidth: "500px" }}>
      <div className="card">
        <h3>Assignment Builder</h3>
        <div className="p-fluid formgrid grid">
          <div className="field col-12">
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

          {selectedAssignment && <AssignmentMainForm />}
        </div>
      </div>
    </div>
  );
};
