import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";

import { ReadingsToolbar } from "./ReadingsToolbar";

const { mockOpenModal, mockOpenConfirmModal } = vi.hoisted(() => ({
  mockOpenModal: vi.fn(),
  mockOpenConfirmModal: vi.fn()
}));

vi.mock("./components/ChooseReadingsButton", () => ({
  ChooseReadingsButton: () => <button type="button">Choose readings</button>
}));

vi.mock("@mantine/modals", async (importOriginal) => {
  const original = await importOriginal<typeof import("@mantine/modals")>();

  return {
    ...original,
    modals: { ...original.modals, open: mockOpenModal, openConfirmModal: mockOpenConfirmModal }
  };
});

const baseProps = {
  globalFilter: "",
  setGlobalFilter: vi.fn(),
  totalCount: 3,
  selectedReadings: [] as Exercise[],
  handleRemoveSelected: vi.fn()
};

describe("ReadingsToolbar", () => {
  it("renders the title, reading count, and primary action", () => {
    renderWithMantine(<ReadingsToolbar {...baseProps} />);
    expect(screen.getByRole("heading", { name: "Sections to read" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose readings" })).toBeInTheDocument();
  });

  it("opens the reading information dialog through the shared modals system", async () => {
    renderWithMantine(<ReadingsToolbar {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Reading information" }));
    expect(mockOpenModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sections to read" })
    );
  });

  it("disables the remove button when nothing is selected", () => {
    renderWithMantine(<ReadingsToolbar {...baseProps} />);

    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(mockOpenConfirmModal).not.toHaveBeenCalled();
  });

  it("asks for confirmation before removing the selected readings", async () => {
    const handleRemoveSelected = vi.fn();

    renderWithMantine(
      <ReadingsToolbar
        {...baseProps}
        selectedReadings={[{ id: 1 } as Exercise, { id: 2 } as Exercise]}
        handleRemoveSelected={handleRemoveSelected}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove (2)" }));

    expect(handleRemoveSelected).not.toHaveBeenCalled();
    expect(mockOpenConfirmModal).toHaveBeenCalledTimes(1);

    mockOpenConfirmModal.mock.calls[0][0].onConfirm();
    expect(handleRemoveSelected).toHaveBeenCalledTimes(1);
  });

  it("uses the singular noun when confirming removal of one reading", async () => {
    renderWithMantine(
      <ReadingsToolbar {...baseProps} selectedReadings={[{ id: 1 } as Exercise]} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove (1)" }));

    const { children } = mockOpenConfirmModal.mock.calls[0][0];
    const { container } = renderWithMantine(<>{children}</>);

    expect(container).toHaveTextContent("Remove 1 reading from this assignment?");
  });

  it("uses the plural noun when confirming removal of several readings", async () => {
    renderWithMantine(
      <ReadingsToolbar
        {...baseProps}
        selectedReadings={[{ id: 1 } as Exercise, { id: 2 } as Exercise]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove (2)" }));

    const { children } = mockOpenConfirmModal.mock.calls[0][0];
    const { container } = renderWithMantine(<>{children}</>);

    expect(container).toHaveTextContent("Remove 2 readings from this assignment?");
  });

  it("forwards search input changes", async () => {
    const setGlobalFilter = vi.fn();

    renderWithMantine(<ReadingsToolbar {...baseProps} setGlobalFilter={setGlobalFilter} />);

    await userEvent.type(screen.getByPlaceholderText("Search readings…"), "a");
    expect(setGlobalFilter).toHaveBeenCalledWith("a");
  });

  it("reflects the scrolled state on the toolbar element", () => {
    const { container } = renderWithMantine(<ReadingsToolbar {...baseProps} scrolled />);

    expect(container.querySelector("[data-scrolled]")).not.toBeNull();
  });

  it("has no scrolled marker at rest", () => {
    const { container } = renderWithMantine(<ReadingsToolbar {...baseProps} />);

    expect(container.querySelector("[data-scrolled]")).toBeNull();
  });
});
