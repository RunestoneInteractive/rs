import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useRouteHeadingFocus } from "./useRouteHeadingFocus";

const TestPage = () => {
  const location = useLocation();
  const headingRef = useRouteHeadingFocus(location.pathname);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        {location.pathname}
      </h1>
      <Link to="/next">Next page</Link>
      <button type="button">Unrelated action</button>
    </>
  );
};

describe("useRouteHeadingFocus", () => {
  it("focuses the heading on initial render and after navigation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/start"]}>
        <TestPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "/start" })).toHaveFocus();

    await user.click(screen.getByRole("link", { name: "Next page" }));

    expect(screen.getByRole("heading", { level: 1, name: "/next" })).toHaveFocus();
  });

  it("does not steal focus when the route is unchanged", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/start"]}>
        <TestPage />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: "Unrelated action" });

    await user.click(button);

    expect(button).toHaveFocus();
  });
});
