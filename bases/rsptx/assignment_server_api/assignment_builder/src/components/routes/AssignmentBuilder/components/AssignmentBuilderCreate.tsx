import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery
} from "@store/assignment/assignment.logic.api";
import { useParams, useNavigate } from "react-router-dom";

import { CreateAssignmentPayload } from "@/types/assignment";

import { Loader } from "../../../ui/Loader";
import { useAssignmentForm } from "../hooks/useAssignmentForm";
import { useAssignmentState } from "../hooks/useAssignmentState";
import { useNameValidation } from "../hooks/useNameValidation";

import { AssignmentBuilderLayout } from "./AssignmentBuilderLayout";
import { AssignmentWizard } from "./wizard/AssignmentWizard";

export const AssignmentBuilderCreate = () => {
  const { step } = useParams<{ step?: string }>();
  const navigate = useNavigate();
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

  const wizardStep = step === "type" ? "type" : step === "visibility" ? "visibility" : "basic";
  console.log(step, wizardStep);
  const handleBack = () => {
    if (wizardStep === "basic") {
      navigate("/builder");
    } else if (wizardStep === "type") {
      navigate("/builder/create");
    } else if (wizardStep === "visibility") {
      navigate("/builder/create/type");
    }
  };

  const handleNext = () => {
    if (wizardStep === "basic") {
      navigate("/builder/create/type");
    } else if (wizardStep === "type") {
      navigate("/builder/create/visibility");
    }
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
      visible: formValues.visible,
      visible_on: formValues.visible_on || null,
      hidden_on: formValues.hidden_on || null,
      released: true,
      enforce_due: formValues.enforce_due || false
    };

    createAssignment(payload);
    navigate("/builder");
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
