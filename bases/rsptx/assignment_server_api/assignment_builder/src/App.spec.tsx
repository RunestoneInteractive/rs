import { render } from "@testing-library/react";

// ignore this until all files are migrated to TypeScript.
//@ts-ignore
import App from "./App";

vi.mock("react-redux", () => ({
  useSelector: () => false
}));

describe("App", () => {
  it("renders learn react link", () => {
    const { getByText } = render(<App />);

    expect(getByText("Error fetching assignments, you may not be authorized.")).toBeInTheDocument();
  });
});
