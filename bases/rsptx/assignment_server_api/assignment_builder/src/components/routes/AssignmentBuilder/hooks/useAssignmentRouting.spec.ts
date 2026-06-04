import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

import { useAssignmentRouting } from "./useAssignmentRouting";

const setPath = (path: string) => {
  Object.defineProperty(window, "location", {
    value: { ...window.location, pathname: path },
    writable: true,
    configurable: true
  });
};

const wrap = (path: string, routePattern = "*") => {
  setPath(path);
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: routePattern, element: children })
        )
      )
  };
};

const EDIT_ROUTES = [
  "/builder/:assignmentId",
  "/builder/:assignmentId/readings",
  "/builder/:assignmentId/exercises",
  "/builder/:assignmentId/exercises/browse",
  "/builder/:assignmentId/exercises/search",
  "/builder/:assignmentId/exercises/create",
  "/builder/:assignmentId/exercises/create/:exerciseType",
  "/builder/:assignmentId/exercises/create/:exerciseType/:exerciseSubType",
  "/builder/:assignmentId/exercises/create/:exerciseType/:exerciseSubType/:step",
  "/builder/:assignmentId/exercises/edit",
  "/builder/:assignmentId/exercises/edit/:exerciseId",
  "/builder/:assignmentId/exercises/edit/:exerciseId/:step"
];

const wrapEdit = (path: string) => {
  setPath(path);
  const pattern =
    EDIT_ROUTES.find((r) => {
      const segments = r.split("/");
      const pathSegments = path.split("/");
      if (segments.length !== pathSegments.length) return false;
      return segments.every((s, i) => s.startsWith(":") || s === pathSegments[i]);
    }) ?? "*";

  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: pattern, element: children })
        )
      )
  };
};

describe("useAssignmentRouting", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe("routeState derivation from path", () => {
    it("sets mode to list when path is /builder", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder"));
      expect(result.current.mode).toBe("list");
      expect(result.current.selectedAssignmentId).toBeNull();
    });

    it("sets mode to list when path is /builder/", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/"));
      expect(result.current.mode).toBe("list");
    });

    it("sets mode to create and wizardStep to basic for /builder/create", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      expect(result.current.mode).toBe("create");
      expect(result.current.wizardStep).toBe("basic");
    });

    it("sets wizardStep to type for /builder/create/type", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create/type"));
      expect(result.current.mode).toBe("create");
      expect(result.current.wizardStep).toBe("type");
    });

    it("sets wizardStep to visibility for /builder/create/visibility", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrap("/builder/create/visibility")
      );
      expect(result.current.mode).toBe("create");
      expect(result.current.wizardStep).toBe("visibility");
    });

    it("sets mode to edit and captures assignmentId for /builder/:id", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42"));
      expect(result.current.mode).toBe("edit");
      expect(result.current.selectedAssignmentId).toBe("42");
      expect(result.current.activeTab).toBe("basic");
    });

    it("sets activeTab to readings for /builder/:id/readings", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42/readings"));
      expect(result.current.mode).toBe("edit");
      expect(result.current.activeTab).toBe("readings");
    });

    it("sets activeTab to exercises and exerciseViewMode to list for /builder/:id/exercises", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      expect(result.current.activeTab).toBe("exercises");
      expect(result.current.exerciseViewMode).toBe("list");
    });

    it("sets exerciseViewMode to browse for /builder/:id/exercises/browse", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/browse")
      );
      expect(result.current.exerciseViewMode).toBe("browse");
    });

    it("sets exerciseViewMode to search for /builder/:id/exercises/search", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/search")
      );
      expect(result.current.exerciseViewMode).toBe("search");
    });

    it("sets exerciseViewMode to create and captures exerciseType", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/create/mchoice")
      );
      expect(result.current.exerciseViewMode).toBe("create");
      expect(result.current.exerciseType).toBe("mchoice");
      expect(result.current.exerciseSubType).toBeNull();
      expect(result.current.exerciseStep).toBe(0);
    });

    it("captures exerciseSubType for /builder/:id/exercises/create/:type/:subType", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/create/mchoice/advanced")
      );
      expect(result.current.exerciseType).toBe("mchoice");
      expect(result.current.exerciseSubType).toBe("advanced");
    });

    it("parses exerciseStep for create mode with step segment", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/create/mchoice/advanced/2")
      );
      expect(result.current.exerciseStep).toBe(2);
    });

    it("sets exerciseViewMode to edit and captures exerciseId", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/edit/99")
      );
      expect(result.current.exerciseViewMode).toBe("edit");
      expect(result.current.exerciseId).toBe("99");
      expect(result.current.exerciseStep).toBe(0);
    });

    it("parses exerciseStep for edit mode with step segment", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/edit/99/3")
      );
      expect(result.current.exerciseStep).toBe(3);
    });

    it("returns default state for unrecognized path", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/unknown"));
      expect(result.current.mode).toBe("list");
      expect(result.current.wizardStep).toBe("basic");
      expect(result.current.activeTab).toBe("basic");
      expect(result.current.exerciseViewMode).toBe("list");
      expect(result.current.exerciseType).toBeNull();
      expect(result.current.exerciseSubType).toBeNull();
      expect(result.current.exerciseStep).toBe(0);
      expect(result.current.exerciseId).toBeNull();
    });
  });

  describe("navigateToList", () => {
    it("calls navigate with /builder", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder"));
      act(() => result.current.navigateToList());
      expect(mockNavigate).toHaveBeenCalledWith("/builder");
    });
  });

  describe("navigateToCreate", () => {
    it("calls navigate with /builder/create when no step given", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      act(() => result.current.navigateToCreate());
      expect(mockNavigate).toHaveBeenCalledWith("/builder/create");
    });

    it("calls navigate with /builder/create/type for step=type", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      act(() => result.current.navigateToCreate("type"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/create/type");
    });

    it("calls navigate with /builder/create/visibility for step=visibility", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      act(() => result.current.navigateToCreate("visibility"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/create/visibility");
    });

    it("calls navigate with /builder/create for step=basic", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      act(() => result.current.navigateToCreate("basic"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/create");
    });
  });

  describe("navigateToEdit", () => {
    it("navigates to /builder/:id for tab=basic", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42"));
      act(() => result.current.navigateToEdit("42", "basic"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42");
    });

    it("navigates to /builder/:id/readings for tab=readings", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42"));
      act(() => result.current.navigateToEdit("42", "readings"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/readings");
    });

    it("navigates to /builder/:id/exercises for tab=exercises", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42"));
      act(() => result.current.navigateToEdit("42", "exercises"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises");
    });

    it("defaults tab to basic when omitted", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42"));
      act(() => result.current.navigateToEdit("42"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42");
    });
  });

  describe("navigateToExercises", () => {
    it("navigates to /builder/:id/exercises for list viewMode", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "list"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises");
    });

    it("navigates to /builder/:id/exercises for default viewMode", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises");
    });

    it("navigates to browse path", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "browse"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/browse");
    });

    it("navigates to search path", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "search"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/search");
    });

    it("navigates to create path with exerciseType only", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "create", { exerciseType: "mchoice" }));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice");
    });

    it("navigates to create path with exerciseType and exerciseSubType", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() =>
        result.current.navigateToExercises("42", "create", {
          exerciseType: "mchoice",
          exerciseSubType: "advanced"
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice/advanced");
    });

    it("navigates to create path with exerciseType, subType, and step", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() =>
        result.current.navigateToExercises("42", "create", {
          exerciseType: "mchoice",
          exerciseSubType: "advanced",
          step: 2
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice/advanced/2");
    });

    it("does not append exerciseType segment when create mode has no exerciseType", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "create"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create");
    });

    it("navigates to edit path with exerciseId", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "edit", { exerciseId: "99" }));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/edit/99");
    });

    it("navigates to edit path with exerciseId and step", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "edit", { exerciseId: "99", step: 3 }));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/edit/99/3");
    });

    it("does not append exerciseId segment when edit mode has no exerciseId", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExercises("42", "edit"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/edit");
    });
  });

  describe("navigateToExerciseTypeSelection", () => {
    it("navigates to /builder/:id/exercises/create/:type", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExerciseTypeSelection("42", "mchoice"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice");
    });
  });

  describe("navigateToExerciseSubTypeSelection", () => {
    it("navigates to /builder/:id/exercises/create/:type/:subType", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.navigateToExerciseSubTypeSelection("42", "mchoice", "advanced"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice/advanced");
    });
  });

  describe("updateWizardStep", () => {
    it("navigates to /builder/create/type", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      act(() => result.current.updateWizardStep("type"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/create/type");
    });

    it("navigates to /builder/create/visibility", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      act(() => result.current.updateWizardStep("visibility"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/create/visibility");
    });

    it("navigates to /builder/create for basic step", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder/create"));
      act(() => result.current.updateWizardStep("basic"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/create");
    });
  });

  describe("updateEditTab", () => {
    it("does not navigate when no selectedAssignmentId", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder"));
      act(() => result.current.updateEditTab("readings"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("navigates to exercises tab", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42/readings"));
      act(() => result.current.updateEditTab("exercises"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises");
    });

    it("navigates to base path when tab is basic", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrapEdit("/builder/42/readings"));
      act(() => result.current.updateEditTab("basic"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42");
    });
  });

  describe("updateExerciseViewMode", () => {
    it("does not navigate when no selectedAssignmentId", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder"));
      act(() => result.current.updateExerciseViewMode("browse"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("navigates to browse mode", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.updateExerciseViewMode("browse"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/browse");
    });

    it("forwards create options", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.updateExerciseViewMode("create", { exerciseType: "mchoice" }));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice");
    });
  });

  describe("updateExerciseType", () => {
    it("does not navigate when no selectedAssignmentId", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder"));
      act(() => result.current.updateExerciseType("mchoice"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("navigates with exerciseType", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.updateExerciseType("mchoice"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice");
    });
  });

  describe("updateExerciseSubType", () => {
    it("does not navigate when no selectedAssignmentId", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder"));
      act(() => result.current.updateExerciseSubType("advanced"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("does not navigate when exerciseType is not set", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.updateExerciseSubType("advanced"));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("navigates when both selectedAssignmentId and exerciseType are set", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/create/mchoice")
      );
      act(() => result.current.updateExerciseSubType("advanced"));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice/advanced");
    });
  });

  describe("updateExerciseStep", () => {
    it("does not navigate when no selectedAssignmentId", () => {
      const { result } = renderHook(() => useAssignmentRouting(), wrap("/builder"));
      act(() => result.current.updateExerciseStep(1));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("does not navigate when exerciseViewMode is list", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises")
      );
      act(() => result.current.updateExerciseStep(1));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("does not navigate in create mode when exerciseType is null", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/create")
      );
      act(() => result.current.updateExerciseStep(1));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("navigates with create options including step", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/create/mchoice/advanced/0")
      );
      act(() => result.current.updateExerciseStep(2));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/create/mchoice/advanced/2");
    });

    it("navigates with edit options including step", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/edit/99/0")
      );
      act(() => result.current.updateExerciseStep(3));
      expect(mockNavigate).toHaveBeenCalledWith("/builder/42/exercises/edit/99/3");
    });

    it("does not navigate in edit mode when exerciseId is null", () => {
      const { result } = renderHook(
        () => useAssignmentRouting(),
        wrapEdit("/builder/42/exercises/edit")
      );
      act(() => result.current.updateExerciseStep(1));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
