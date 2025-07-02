import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery
} from "@store/assignment/assignment.logic.api";
import { useParams } from "react-router-dom";

import { CreateAssignmentPayload } from "@/types/assignment";

import { Loader } from "../../../ui/Loader";
import { useAssignmentForm } from "../hooks/useAssignmentForm";
import { useAssignmentState } from "../hooks/useAssignmentState";
import { useNameValidation } from "../hooks/useNameValidation";

import { AssignmentBuilderLayout } from "./AssignmentBuilderLayout";
import { AssignmentWizard } from "./wizard/AssignmentWizard";

export const AssignmentBuilderCreate = () => {
  const { step } = useParams<{ step?: string }>();
  const { isLoading, isError, data: assignments = [] } = useGetAssignmentsQuery();
  const [createAssignment] = useCreateAssignmentMutation();

  const { handleTypeSelect } = useAssignmentState();

  const { control, watch, setValue, getValues, handleNameChange } = useAssignmentForm({
    selectedAssignment: null,
    mode: "create",
    onAssignmentUpdate: () => {}
  });

  const { nameError, canProceed } = useNameValidation({
    assignments,
    watch
  });

  const wizardStep = step === "type" ? "type" : "basic";

  const handleBack = () => {
    if (wizardStep === "type") {
      window.location.href = "/builder/create";
    } else {
      window.location.href = "/builder";
    }
  };

  const handleNext = () => {
    window.location.href = "/builder/create/type";
  };

  const handleWizardComplete = () => {
    const formValues = getValues();
    const payload: CreateAssignmentPayload = {
      name: formValues.name,
      description: formValues.description,
      duedate: formValues.duedate,
      points: 0,
      kind: formValues.kind || "Regular",
      time_limit: formValues.time_limit,
      nofeedback: formValues.nofeedback,
      nopause: formValues.nopause,
      peer_async_visible: formValues.peer_async_visible,
      visible: false
    };

    createAssignment(payload);
    window.location.href = "/builder";
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
      <AssignmentWizard
        control={control}
        wizardStep={wizardStep}
        nameError={nameError}
        canProceed={canProceed}
        onBack={handleBack}
        onNext={handleNext}
        onComplete={handleWizardComplete}
        onNameChange={handleNameChange}
        onTypeSelect={(type) => handleTypeSelect(type, setValue)}
        watch={watch}
        setValue={setValue}
      />
    </AssignmentBuilderLayout>
  );
};
