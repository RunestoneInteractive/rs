import { AutoComplete } from "@components/ui/AutoComplete";
import { Loader } from "@components/ui/Loader";
import { assignmentActions } from "@store/assignment/assignment.logic";
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery
} from "@store/assignment/assignment.logic.api";
import { useGetAvailableReadingsQuery } from "@store/readings/readings.logic.api";
import { InputSwitch } from "primereact/inputswitch";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { Assignment } from "@/types/assignment";

import { AssignmentViewSelect } from "./components/AssignmentViewSelect";
import { defaultAssignment } from "./defaultAssignment";

export const AssignmentBuilder = () => {
  const dispatch = useDispatch();
  const { isLoading, isError, data: assignments } = useGetAssignmentsQuery();
  const [createAssignment] = useCreateAssignmentMutation();
  const { selectedAssignment, updateAssignment } = useSelectedAssignment();

  useGetAvailableReadingsQuery({
    skipreading: false,
    from_source_only: true,
    pages_only: false
  });

  const { control, watch, setValue, reset, getValues } = useForm<Assignment>({
    defaultValues: selectedAssignment
  });

  const isResetRef = useRef(false);

  useEffect(() => {
    if (selectedAssignment) {
      isResetRef.current = true;
      reset(selectedAssignment);
    }
  }, [selectedAssignment, reset]);

  useEffect(() => {
    const { unsubscribe } = watch((formValues, { name }) => {
      if (isResetRef.current) {
        isResetRef.current = false;

        return;
      }

      updateAssignment(formValues);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const assignmentFromList = assignments.find((a) => a.name === value);

    if (!assignmentFromList) {
      createAssignment({ ...defaultAssignment, name: value });
    } else {
      dispatch(assignmentActions.setSelectedAssignmentId(assignmentFromList.id));
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
              <form style={{ display: "contents" }}>
                <div style={{ paddingTop: "0.5rem" }} className="field col-12 md:col-3  flex">
                  <div className="flex align-items-center flex-shrink-1 gap-1">
                    <label className="label mb-0" htmlFor="visible">
                      Visible to Students
                    </label>
                    <Controller
                      name="visible"
                      control={control}
                      render={({ field }) => (
                        <InputSwitch
                          className="flex-shrink-0"
                          id="visible"
                          checked={field.value}
                          onChange={({ value }) => setValue("visible", value)}
                        />
                      )}
                    />
                  </div>
                </div>
              </form>
              <AssignmentViewSelect control={control} setValue={setValue} getValues={getValues} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
