import { useForm } from "react-hook-form";
import { vi } from "vitest";

import { fireEvent, renderWithMantine, screen } from "@/test/renderWithMantine";
import { Assignment, KindOfAssignment } from "@/types/assignment";

import { AssignmentWizard } from "./AssignmentWizard";

interface HarnessProps {
  wizardStep: "basic" | "type" | "visibility";
  kind?: KindOfAssignment;
  canProceed?: boolean;
  isCreating?: boolean;
  nameError?: string | null;
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  onTypeSelect?: (type: KindOfAssignment) => void;
}

const Harness = ({
  wizardStep,
  kind,
  canProceed = true,
  isCreating = false,
  nameError = null,
  onBack = vi.fn(),
  onNext = vi.fn(),
  onComplete = vi.fn(),
  onTypeSelect = vi.fn()
}: HarnessProps) => {
  const { control, watch, setValue } = useForm<Assignment>({
    defaultValues: {
      name: "",
      description: "",
      duedate: "",
      points: 0,
      kind,
      time_limit: null,
      nofeedback: true,
      nopause: true,
      peer_async_visible: false,
      visible: true,
      visible_on: null,
      hidden_on: null
    } as Partial<Assignment>
  });

  return (
    <AssignmentWizard
      control={control}
      wizardStep={wizardStep}
      nameError={nameError}
      canProceed={canProceed}
      isCreating={isCreating}
      onBack={onBack}
      onNext={onNext}
      onComplete={onComplete}
      onNameChange={vi.fn()}
      onTypeSelect={onTypeSelect}
      watch={watch}
      setValue={setValue}
    />
  );
};

describe("AssignmentWizard", () => {
  it("renders the stepper with all three step labels", () => {
    renderWithMantine(<Harness wizardStep="basic" />);

    expect(screen.getByText("Basic info")).toBeInTheDocument();
    expect(screen.getByText("Assignment type")).toBeInTheDocument();
    expect(screen.getByText("Visibility")).toBeInTheDocument();
  });

  it("renders the basic info step with name, description and due date fields", () => {
    renderWithMantine(<Harness wizardStep="basic" />);

    expect(screen.getByRole("heading", { name: "Basic information" })).toBeInTheDocument();
    expect(screen.getByLabelText("Assignment name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Due date")).toBeInTheDocument();
  });

  it("disables Next on the basic step when canProceed is false", () => {
    renderWithMantine(<Harness wizardStep="basic" canProceed={false} />);

    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
  });

  it("shows the name validation error", () => {
    renderWithMantine(<Harness wizardStep="basic" nameError="Name already exists" />);

    expect(screen.getByText("Name already exists")).toBeInTheDocument();
  });

  it("renders three type cards and marks the selected one with a check badge", () => {
    renderWithMantine(<Harness wizardStep="type" kind="Timed" />);

    const selected = screen.getByRole("button", { pressed: true });

    expect(selected).toHaveTextContent("Quiz/Exam");
    expect(screen.getByTestId("type-check-badge")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { pressed: false }).length).toBeGreaterThanOrEqual(2);
  });

  it("calls onTypeSelect with the card type when a type card is clicked", () => {
    const onTypeSelect = vi.fn();

    renderWithMantine(<Harness wizardStep="type" onTypeSelect={onTypeSelect} />);

    fireEvent.click(screen.getByText("Peer"));

    expect(onTypeSelect).toHaveBeenCalledWith("Peer");
  });

  it("shows the settings panel matching the selected kind", () => {
    const { unmount } = renderWithMantine(<Harness wizardStep="type" kind="Regular" />);

    expect(screen.getByText("No additional options")).toBeInTheDocument();
    unmount();

    renderWithMantine(<Harness wizardStep="type" kind="Timed" />);

    expect(screen.getByText("Quiz/Exam settings")).toBeInTheDocument();
    expect(screen.getByText("Allow pause")).toBeInTheDocument();
    expect(screen.getByText("Allow feedback")).toBeInTheDocument();
  });

  it("renders the active step title as the page h1", () => {
    renderWithMantine(<Harness wizardStep="basic" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Basic information" })
    ).toBeInTheDocument();
  });

  it("disables Create assignment while the creation request is pending", () => {
    const onComplete = vi.fn();

    renderWithMantine(<Harness wizardStep="visibility" isCreating onComplete={onComplete} />);

    const createButton = screen.getByRole("button", { name: /Create assignment/ });

    expect(createButton).toHaveAttribute("data-loading", "true");

    fireEvent.click(createButton);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onComplete from the visibility step", () => {
    const onComplete = vi.fn();

    renderWithMantine(<Harness wizardStep="visibility" onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /Create assignment/ }));

    expect(onComplete).toHaveBeenCalled();
  });

  it("calls onBack from any step", () => {
    const onBack = vi.fn();

    renderWithMantine(<Harness wizardStep="type" onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: /Back/ }));

    expect(onBack).toHaveBeenCalled();
  });
});
