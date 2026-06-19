import { modals } from "@mantine/modals";
import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";

import { ExistingDataFile } from "@/types/datafile";

import { DataFilesEditor } from "./DataFilesEditor";

const deleteUnwrap = vi.fn().mockResolvedValue({});
const deleteDatafile = vi.fn(() => ({ unwrap: deleteUnwrap }));

const existingDatafiles: ExistingDataFile[] = [
  {
    id: 1,
    acid: "file_a",
    filename: "data.csv",
    course_id: "overview",
    owner: "teacher",
    main_code: "a,b,c"
  }
];

vi.mock("@/store/datafile/datafile.logic.api", () => ({
  useFetchDatafilesQuery: () => ({ data: existingDatafiles, isLoading: false }),
  useCreateDatafileMutation: () => [vi.fn(() => ({ unwrap: vi.fn() })), { isLoading: false }],
  useUpdateDatafileMutation: () => [vi.fn(() => ({ unwrap: vi.fn() })), { isLoading: false }],
  useDeleteDatafileMutation: () => [deleteDatafile, { isLoading: false }],
  useFetchDatafileQuery: () => ({ data: undefined, isFetching: false })
}));

describe("DataFilesEditor", () => {
  it("renders the selector and a selected file row with actions", () => {
    renderWithMantine(
      <DataFilesEditor selectedDataFiles={["file_a"]} onSelectedDataFilesChange={vi.fn()} />
    );

    expect(screen.getByPlaceholderText("Select data files to include")).toBeInTheDocument();
    expect(screen.getAllByText("data.csv").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Edit data file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete data file" })).toBeInTheDocument();
  });

  it("opens the create modal from Create data file", async () => {
    renderWithMantine(
      <DataFilesEditor selectedDataFiles={[]} onSelectedDataFilesChange={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Create data file" }));

    expect(await screen.findByText("Create data file", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g., data.txt or image.png")).toBeInTheDocument();
    expect(screen.getByText("File content")).toBeInTheDocument();
  });

  it("confirms before deleting a data file", async () => {
    const openConfirm = vi.spyOn(modals, "openConfirmModal");

    renderWithMantine(
      <DataFilesEditor selectedDataFiles={["file_a"]} onSelectedDataFilesChange={vi.fn()} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete data file" }));

    await waitFor(() => expect(openConfirm).toHaveBeenCalledTimes(1));
    expect(openConfirm.mock.calls[0][0]).toMatchObject({ title: "Delete data file" });

    openConfirm.mockRestore();
  });
});
