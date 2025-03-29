import { Loader } from "@components/ui/Loader";
import { assignmentActions } from "@store/assignment/assignment.logic";
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery,
  useUpdateAssignmentMutation
} from "@store/assignment/assignment.logic.api";
import {
  useGetAutoGradeOptionsQuery,
  useGetLanguageOptionsQuery,
  useGetQuestionTypeOptionsQuery,
  useGetWhichToGradeOptionsQuery
} from "@store/dataset/dataset.logic.api";
import { useGetAvailableReadingsQuery } from "@store/readings/readings.logic.api";
import sortBy from "lodash/sortBy";
import { toast } from "react-hot-toast";
import { useDispatch } from "react-redux";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { Assignment, CreateAssignmentPayload } from "@/types/assignment";

import { AssignmentEdit } from "./components/edit/AssignmentEdit";
import { AssignmentList } from "./components/list/AssignmentList";
import { AssignmentWizard } from "./components/wizard/AssignmentWizard";
import { defaultAssignment } from "./defaultAssignment";
import { useAssignmentForm } from "./hooks/useAssignmentForm";
import { useAssignmentState } from "./hooks/useAssignmentState";
import { useNameValidation } from "./hooks/useNameValidation";

export const AssignmentBuilder = () => {
  const dispatch = useDispatch();
  const { isLoading, isError, data: assignments = [] } = useGetAssignmentsQuery();
  const [createAssignment] = useCreateAssignmentMutation();
  const [updateAssignment] = useUpdateAssignmentMutation();
  const { selectedAssignment, updateAssignment: updateSelectedAssignment } =
    useSelectedAssignment();

  // Load all required data
  useGetAutoGradeOptionsQuery();
  useGetWhichToGradeOptionsQuery();
  useGetLanguageOptionsQuery();
  useGetQuestionTypeOptionsQuery();
  useGetAvailableReadingsQuery({
    skipreading: false,
    from_source_only: true,
    pages_only: false
  });

  // Custom hooks for state management
  const {
    mode,
    setMode,
    wizardStep,
    setWizardStep,
    globalFilter,
    setGlobalFilter,
    isCollapsed,
    setIsCollapsed,
    activeTab,
    setActiveTab,
    handleTypeSelect
  } = useAssignmentState();

  // Form management
  const { control, watch, setValue, reset, getValues, handleNameChange } = useAssignmentForm({
    selectedAssignment: selectedAssignment || null,
    mode,
    onAssignmentUpdate: updateSelectedAssignment
  });

  // Name validation
  const { nameError, canProceed } = useNameValidation({
    assignments,
    watch
  });

  // Event handlers
  const handleCreateNew = () => {
    setMode("create");
    reset(defaultAssignment);
    setWizardStep("basic");
  };

  const handleEdit = (assignment: Assignment) => {
    dispatch(assignmentActions.setSelectedAssignmentId(assignment.id));
    setMode("edit");
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
      peer_async_visible: formValues.peer_async_visible
    };

    createAssignment(payload);
    setMode("list");
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
    <div className="root">
      {mode === "list" && (
        <AssignmentList
          assignments={sortBy(assignments, (x) => x.id)}
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDuplicate={createAssignment}
          onVisibilityChange={handleVisibilityChange}
        />
      )}
      {mode === "create" && (
        <AssignmentWizard
          control={control}
          wizardStep={wizardStep}
          nameError={nameError}
          canProceed={canProceed}
          onBack={() => {
            if (wizardStep === "type") {
              setWizardStep("basic");
            } else {
              setMode("list");
            }
          }}
          onNext={() => setWizardStep("type")}
          onComplete={handleWizardComplete}
          onNameChange={handleNameChange}
          onTypeSelect={(type) => handleTypeSelect(type, setValue)}
          watch={watch}
        />
      )}
      {mode === "edit" && (
        <AssignmentEdit
          control={control}
          selectedAssignment={selectedAssignment || null}
          isCollapsed={isCollapsed}
          activeTab={activeTab}
          onCollapse={() => setIsCollapsed(!isCollapsed)}
          onBack={() => setMode("list")}
          onTabChange={setActiveTab}
          onTypeSelect={(type) => handleTypeSelect(type, setValue)}
          watch={watch}
        />
      )}
    </div>
  );
};
