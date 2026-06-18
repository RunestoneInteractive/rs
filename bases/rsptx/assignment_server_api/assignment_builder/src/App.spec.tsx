import { render } from "@testing-library/react";

import App from "./App";

vi.mock("react-redux", () => ({
  useSelector: () => false
}));

describe("App", () => {
  it("renders learn react link", () => {
    const { getByText } = render(<App />);

    expect(
      getByText("Couldn't load assignments. You may not have instructor access. Sign in again.")
    ).toBeInTheDocument();
  });
});
