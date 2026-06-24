import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { TabToolbar } from "./TabToolbar";

describe("TabToolbar", () => {
  it("renders the title, count, extra content, and actions", () => {
    renderWithMantine(
      <TabToolbar title="Exercises" count={5} titleExtra={<span>extra</span>}>
        <button type="button">Action</button>
      </TabToolbar>
    );
    expect(screen.getByRole("heading", { name: "Exercises" })).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("extra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  it("renders the leading element before the title", () => {
    renderWithMantine(
      <TabToolbar title="Choose from book" count={0} leading={<button type="button">Back</button>} />
    );

    const back = screen.getByRole("button", { name: "Back" });
    const title = screen.getByRole("heading", { name: "Choose from book" });

    expect(back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks the toolbar only when scrolled", () => {
    const { container, unmount } = renderWithMantine(
      <TabToolbar title="Exercises" count={0} scrolled />
    );

    expect(container.querySelector("[data-scrolled]")).not.toBeNull();
    unmount();

    const { container: rest } = renderWithMantine(<TabToolbar title="Exercises" count={0} />);

    expect(rest.querySelector("[data-scrolled]")).toBeNull();
  });
});
