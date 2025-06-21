import { useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export type AssignmentMode = "list" | "create" | "edit";
export type WizardStep = "basic" | "type";
export type EditTab = "basic" | "readings" | "exercises";
export type ExerciseViewMode = "list" | "browse" | "search" | "create" | "edit";

interface AssignmentRouteParams extends Record<string, string | undefined> {
  assignmentId?: string;
  exerciseId?: string;
  exerciseType?: string;
  exerciseSubType?: string;
  step?: string;
}

interface AssignmentRouteState {
  mode: AssignmentMode;
  selectedAssignmentId: string | null;
  wizardStep: WizardStep;
  activeTab: EditTab;
  exerciseViewMode: ExerciseViewMode;
  exerciseType: string | null;
  exerciseSubType: string | null;
  exerciseStep: number;
  exerciseId: string | null;
}

export const useAssignmentRouting = () => {
  const navigate = useNavigate();
  const params = useParams<AssignmentRouteParams>();

  const routeState = useMemo((): AssignmentRouteState => {
    const path = window.location.pathname;
    const basePath = "/builder";

    let state: AssignmentRouteState = {
      mode: "list",
      selectedAssignmentId: null,
      wizardStep: "basic",
      activeTab: "basic",
      exerciseViewMode: "list",
      exerciseType: null,
      exerciseSubType: null,
      exerciseStep: 0,
      exerciseId: null
    };

    if (path === basePath || path === `${basePath}/`) {
      state.mode = "list";
    } else if (path.includes(`${basePath}/create`)) {
      state.mode = "create";
      if (path.includes("/type")) {
        state.wizardStep = "type";
      } else {
        state.wizardStep = "basic";
      }
    } else if (params.assignmentId) {
      state.mode = "edit";
      state.selectedAssignmentId = params.assignmentId;

      if (path.includes("/readings")) {
        state.activeTab = "readings";
      } else if (path.includes("/exercises")) {
        state.activeTab = "exercises";

        if (path.includes("/browse")) {
          state.exerciseViewMode = "browse";
        } else if (path.includes("/search")) {
          state.exerciseViewMode = "search";
        } else if (path.includes("/create")) {
          state.exerciseViewMode = "create";
          state.exerciseType = params.exerciseType || null;
          state.exerciseSubType = params.exerciseSubType || null;
          state.exerciseStep = params.step ? parseInt(params.step, 10) : 0;
        } else if (path.includes("/edit")) {
          state.exerciseViewMode = "edit";
          state.exerciseId = params.exerciseId || null;
          state.exerciseStep = params.step ? parseInt(params.step, 10) : 0;
        } else {
          state.exerciseViewMode = "list";
        }
      } else {
        state.activeTab = "basic";
      }
    }

    return state;
  }, [params]);

  const navigateToList = useCallback(() => {
    navigate("/builder");
  }, [navigate]);

  const navigateToCreate = useCallback(
    (step?: WizardStep) => {
      if (step === "type") {
        navigate("/builder/create/type");
      } else {
        navigate("/builder/create");
      }
    },
    [navigate]
  );

  const navigateToEdit = useCallback(
    (assignmentId: string, tab: EditTab = "basic") => {
      let path = `/builder/${assignmentId}`;

      if (tab !== "basic") {
        path += `/${tab}`;
      }
      navigate(path);
    },
    [navigate]
  );

  const navigateToExercises = useCallback(
    (
      assignmentId: string,
      viewMode: ExerciseViewMode = "list",
      options?: {
        exerciseType?: string;
        exerciseSubType?: string;
        exerciseId?: string;
        step?: number;
      }
    ) => {
      let path = `/builder/${assignmentId}/exercises`;

      if (viewMode !== "list") {
        path += `/${viewMode}`;

        if (viewMode === "create" && options?.exerciseType) {
          path += `/${options.exerciseType}`;
          if (options.exerciseSubType) {
            path += `/${options.exerciseSubType}`;
          }
          if (options.step !== undefined) {
            path += `/${options.step}`;
          }
        } else if (viewMode === "edit" && options?.exerciseId) {
          path += `/${options.exerciseId}`;
          if (options.step !== undefined) {
            path += `/${options.step}`;
          }
        }
      }

      navigate(path);
    },
    [navigate]
  );

  const navigateToExerciseTypeSelection = useCallback(
    (assignmentId: string, exerciseType: string) => {
      navigate(`/builder/${assignmentId}/exercises/create/${exerciseType}`);
    },
    [navigate]
  );

  const navigateToExerciseSubTypeSelection = useCallback(
    (assignmentId: string, exerciseType: string, exerciseSubType: string) => {
      navigate(`/builder/${assignmentId}/exercises/create/${exerciseType}/${exerciseSubType}`);
    },
    [navigate]
  );

  const updateWizardStep = useCallback(
    (step: WizardStep) => {
      navigateToCreate(step);
    },
    [navigateToCreate]
  );

  const updateEditTab = useCallback(
    (tab: EditTab) => {
      if (routeState.selectedAssignmentId) {
        navigateToEdit(routeState.selectedAssignmentId, tab);
      }
    },
    [navigateToEdit, routeState.selectedAssignmentId]
  );

  const updateExerciseViewMode = useCallback(
    (
      viewMode: ExerciseViewMode,
      options?: {
        exerciseType?: string;
        exerciseSubType?: string;
        exerciseId?: string;
        step?: number;
      }
    ) => {
      if (routeState.selectedAssignmentId) {
        navigateToExercises(routeState.selectedAssignmentId, viewMode, options);
      }
    },
    [navigateToExercises, routeState.selectedAssignmentId]
  );

  const updateExerciseStep = useCallback(
    (step: number) => {
      if (routeState.selectedAssignmentId) {
        if (routeState.exerciseViewMode === "create" && routeState.exerciseType) {
          navigateToExercises(routeState.selectedAssignmentId, "create", {
            exerciseType: routeState.exerciseType,
            exerciseSubType: routeState.exerciseSubType || undefined,
            step
          });
        } else if (routeState.exerciseViewMode === "edit" && routeState.exerciseId) {
          navigateToExercises(routeState.selectedAssignmentId, "edit", {
            exerciseId: routeState.exerciseId,
            step
          });
        }
      }
    },
    [navigateToExercises, routeState]
  );

  const updateExerciseType = useCallback(
    (exerciseType: string) => {
      if (routeState.selectedAssignmentId) {
        navigateToExerciseTypeSelection(routeState.selectedAssignmentId, exerciseType);
      }
    },
    [navigateToExerciseTypeSelection, routeState.selectedAssignmentId]
  );

  const updateExerciseSubType = useCallback(
    (exerciseSubType: string) => {
      if (routeState.selectedAssignmentId && routeState.exerciseType) {
        navigateToExerciseSubTypeSelection(
          routeState.selectedAssignmentId,
          routeState.exerciseType,
          exerciseSubType
        );
      }
    },
    [navigateToExerciseSubTypeSelection, routeState.selectedAssignmentId, routeState.exerciseType]
  );

  return {
    // Current state
    ...routeState,

    // Navigation functions
    navigateToList,
    navigateToCreate,
    navigateToEdit,
    navigateToExercises,
    navigateToExerciseTypeSelection,
    navigateToExerciseSubTypeSelection,
    updateWizardStep,
    updateEditTab,
    updateExerciseViewMode,
    updateExerciseStep,
    updateExerciseType,
    updateExerciseSubType
  };
};
