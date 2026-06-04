import { describe, expect, it } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { Loader } from "./Loader";

describe("Loader", () => {
  it("renders a visible loading indicator", () => {
    const { container } = renderWithMantine(<Loader />);
    expect(container.querySelector(".mantine-Loader-root")).toBeInTheDocument();
  });
});
