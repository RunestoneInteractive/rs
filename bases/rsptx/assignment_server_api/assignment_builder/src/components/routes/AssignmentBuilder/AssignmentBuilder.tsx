import { Loader } from "@components/ui/Loader";
import { assignmentActions } from "@store/assignment/assignment.logic";
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery,
  useRemoveAssignmentMutation,
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
import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { useDispatch } from "react-redux";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { Assignment, CreateAssignmentPayload } from "@/types/assignment";

import { RoutingDebug } from "./components/RoutingDebug";
import { AssignmentEdit } from "./components/edit/AssignmentEdit";
import { AssignmentList } from "./components/list/AssignmentList";
import { AssignmentWizard } from "./components/wizard/AssignmentWizard";
import { defaultAssignment } from "./defaultAssignment";
import { useAssignmentForm } from "./hooks/useAssignmentForm";
import { useAssignmentRouting } from "./hooks/useAssignmentRouting";
import { useAssignmentState } from "./hooks/useAssignmentState";
import { useNameValidation } from "./hooks/useNameValidation";

export const AssignmentBuilder = () => {
  const dispatch = useDispatch();
  const { isLoading, isError, data: assignments = [] } = useGetAssignmentsQuery();
  const [createAssignment] = useCreateAssignmentMutation();
  const [updateAssignment] = useUpdateAssignmentMutation();
  const [removeAssignment] = useRemoveAssignmentMutation();

  // Load all required data

  useGetAutoGradeOptionsQuery();
  useGetWhichToGradeOptionsQuery();
  useGetLanguageOptionsQuery();
  useGetQuestionTypeOptionsQuery();
  useGetAvailableReadingsQuery({
    skipreading: false,
    from_source_only: false,
    pages_only: false
  });

  // Routing management
  const {
    mode,
    selectedAssignmentId,
    wizardStep,
    activeTab,
    navigateToList,
    navigateToCreate,
    navigateToEdit,
    updateWizardStep,
    updateEditTab
  } = useAssignmentRouting();

  // Get selected assignment from routing
  const { selectedAssignment, updateAssignment: updateSelectedAssignment } =
    useSelectedAssignment();

  // Update selected assignment ID in store when route changes
  useEffect(() => {
    if (selectedAssignmentId && selectedAssignmentId !== selectedAssignment?.id?.toString()) {
      dispatch(assignmentActions.setSelectedAssignmentId(parseInt(selectedAssignmentId, 10)));
    }
  }, [selectedAssignmentId, selectedAssignment?.id, dispatch]);

  // Custom hooks for state management
  const { globalFilter, setGlobalFilter, isCollapsed, setIsCollapsed, handleTypeSelect } =
    useAssignmentState();

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
    navigateToCreate("basic");
    reset(defaultAssignment);
  };

  const handleEdit = (assignment: Assignment) => {
    dispatch(assignmentActions.setSelectedAssignmentId(assignment.id));
    navigateToEdit(assignment.id.toString(), "basic");
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

  const handleWizardComplete = async () => {
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
    const response = await createAssignment(payload).unwrap();
    const createdAssignmentId = response.detail.id;

    navigateToEdit(createdAssignmentId.toString());
  };
  const onRemove = async (assignment: Assignment) => {
    removeAssignment(assignment);
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
      <RoutingDebug />
      {mode === "list" && (
        <AssignmentList
          assignments={sortBy(assignments, (x) => x.id)}
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDuplicate={createAssignment}
          onVisibilityChange={handleVisibilityChange}
          onRemove={onRemove}
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
              updateWizardStep("basic");
            } else {
              navigateToList();
            }
          }}
          onNext={() => updateWizardStep("type")}
          onComplete={handleWizardComplete}
          onNameChange={handleNameChange}
          onTypeSelect={(type) => handleTypeSelect(type, setValue)}
          watch={watch}
          setValue={setValue}
        />
      )}
      {mode === "edit" && (
        <AssignmentEdit
          control={control}
          selectedAssignment={selectedAssignment || null}
          isCollapsed={isCollapsed}
          activeTab={activeTab}
          onCollapse={() => setIsCollapsed(!isCollapsed)}
          onBack={() => navigateToList()}
          onTabChange={updateEditTab}
          onTypeSelect={(type) => handleTypeSelect(type, setValue)}
          watch={watch}
          setValue={setValue}
        />
      )}
    </div>
  );
};
