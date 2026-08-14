import { renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";
import { Exercise } from "@/types/exercises";
import { notify } from "@components/ui/notify";

import { AssignmentExercisesContainer } from "./AssignmentExercisesContainer";

const updateExerciseViewMode = vi.fn();
const routing = {
  exerciseViewMode: "edit" as string,
  exerciseId: null as string | null,
  updateExerciseViewMode
};

const exercisesSelector = {
  loading: false,
  error: false,
  assignmentExercises: [] as Exercise[],
  exercisesReady: true,
  refetch: vi.fn()
};

let jwtUsername: string | null = "testuser1";

vi.mock("@components/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: () => []
}));

vi.mock("@store/exercises/exercises.logic", () => ({
  exercisesActions: { setSelectedExercises: vi.fn() },
  exercisesSelectors: { getSelectedExercises: vi.fn() }
}));

vi.mock("../../../hooks/useAssignmentRouting", () => ({
  useAssignmentRouting: () => routing
}));

vi.mock("@/hooks/useExercisesSelector", () => ({
  useExercisesSelector: () => exercisesSelector
}));

vi.mock("@/hooks/useJwtUser", () => ({
  useJwtUser: () => ({ username: jwtUsername })
}));

vi.mock("@/hooks/useUpdateAssignmentExercise", () => ({
  useUpdateAssignmentExercise: () => ({ updateAssignmentExercises: vi.fn() })
}));

// The editor itself is exercised by its own specs; here we only care that the
// deep link resolved to the right exercise.
vi.mock("./EditView", () => ({
  EditView: ({ currentEditExercise }: { currentEditExercise: Exercise | null }) =>
    currentEditExercise ? <div>editing {currentEditExercise.name}</div> : null
}));

vi.mock("./ExerciseListView", () => ({ ExerciseListView: () => <div>list</div> }));
vi.mock("./CreateView", () => ({ CreateView: () => <div>create</div> }));
vi.mock("./ErrorDisplay", () => ({ ErrorDisplay: () => <div>error</div> }));
vi.mock("./ExerciseSuccessDialog", () => ({ ExerciseSuccessDialog: () => null }));
vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/ChooseExercises/ChooseExercises",
  () => ({
    ChooseExercises: () => <div>browse</div>
  })
);
vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/SearchExercises/SmartSearchExercises",
  () => ({
    SmartSearchExercises: () => <div>search</div>
  })
);

const OWNED: Exercise = {
  id: 11,
  question_id: 911,
  name: "exercise_one",
  owner: "testuser1",
  question_type: "mchoice",
  question_json: { statement: "s" }
} as unknown as Exercise;

const NOT_OWNED: Exercise = {
  id: 12,
  question_id: 912,
  name: "exercise_two",
  owner: "someone_else",
  question_type: "mchoice",
  question_json: { statement: "s" }
} as unknown as Exercise;

const baseProps = {
  startItemId: null,
  draggingFieldName: null,
  handleMouseDown: vi.fn(),
  handleMouseUp: vi.fn(),
  handleChange: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  jwtUsername = "testuser1";
  routing.exerciseViewMode = "edit";
  routing.exerciseId = null;
  exercisesSelector.loading = false;
  exercisesSelector.error = false;
  exercisesSelector.exercisesReady = true;
  exercisesSelector.assignmentExercises = [OWNED, NOT_OWNED];
});

describe("AssignmentExercisesContainer deep links", () => {
  it("opens the editor for a question_id in the URL", async () => {
    routing.exerciseId = "911";

    renderWithMantine(<AssignmentExercisesContainer {...baseProps} />);

    expect(await screen.findByText("editing exercise_one")).toBeInTheDocument();
    expect(updateExerciseViewMode).not.toHaveBeenCalled();
  });

  it("falls back to the list for an id that is not in this assignment", async () => {
    routing.exerciseId = "999";

    renderWithMantine(<AssignmentExercisesContainer {...baseProps} />);

    await waitFor(() => expect(updateExerciseViewMode).toHaveBeenCalledWith("list"));
    expect(notify.error).toHaveBeenCalled();
  });

  it("falls back to the list for an exercise the user does not own", async () => {
    routing.exerciseId = "912";

    renderWithMantine(<AssignmentExercisesContainer {...baseProps} />);

    await waitFor(() => expect(updateExerciseViewMode).toHaveBeenCalledWith("list"));
    expect(notify.error).toHaveBeenCalledWith("You can only edit exercises you wrote.");
  });

  it("distinguishes an exercise of yours that simply has no editable data", async () => {
    exercisesSelector.assignmentExercises = [
      { ...OWNED, question_json: null } as unknown as Exercise
    ];
    routing.exerciseId = "911";

    renderWithMantine(<AssignmentExercisesContainer {...baseProps} />);

    await waitFor(() => expect(updateExerciseViewMode).toHaveBeenCalledWith("list"));
    expect(notify.error).toHaveBeenCalledWith("That exercise can't be opened in the editor.");
  });

  // The route still says "edit" until the redirect lands, so the effect reruns.
  it("rejects a bad id only once even if the effect reruns", async () => {
    routing.exerciseId = "999";

    const { rerender } = renderWithMantine(<AssignmentExercisesContainer {...baseProps} />);

    await waitFor(() => expect(updateExerciseViewMode).toHaveBeenCalledWith("list"));
    rerender(<AssignmentExercisesContainer {...baseProps} />);

    await waitFor(() => expect(notify.error).toHaveBeenCalledTimes(1));
  });

  it("waits for the exercise list instead of bouncing to the list mid-load", async () => {
    routing.exerciseId = "911";
    exercisesSelector.exercisesReady = false;
    exercisesSelector.assignmentExercises = [];

    renderWithMantine(<AssignmentExercisesContainer {...baseProps} />);

    await waitFor(() => expect(screen.queryByText(/editing/)).not.toBeInTheDocument());
    expect(updateExerciseViewMode).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
