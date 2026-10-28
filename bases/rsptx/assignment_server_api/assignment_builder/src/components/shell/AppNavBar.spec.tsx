import userEvent from "@testing-library/user-event";

import { NavItem } from "@/navUtils";
import { fireEvent, renderWithMantine, screen, waitFor, within } from "@/test/renderWithMantine";

import { AppNavBar } from "./AppNavBar";

const makeItems = (overrides: Partial<NavItem>[] = []): NavItem[] => [
  { label: "Home", icon: "home", command: vi.fn() },
  { label: "Back to Course", command: vi.fn() },
  {
    label: "User",
    icon: "user",
    items: [
      { label: "Welcome alice", icon: "bolt" },
      { separator: true },
      { label: "Logout", command: vi.fn() },
      { label: "Hidden", command: vi.fn(), visible: false }
    ]
  },
  ...(overrides as NavItem[])
];

describe("AppNavBar", () => {
  it("renders top-level navigation destinations as links", () => {
    const items: NavItem[] = [
      { label: "Grader", href: "/assignment/instructor/grader", command: vi.fn() },
      { label: "Back to Course", href: "/ns/course/index", command: vi.fn() },
      { label: "User", items: [{ label: "Logout", command: vi.fn() }] }
    ];

    renderWithMantine(<AppNavBar items={items} />);

    const grader = screen.getByRole("link", { name: /grader/i });
    const backToCourse = screen.getByRole("link", { name: /back to course/i });
    const user = screen.getByRole("button", { name: /user/i });

    expect(grader).toHaveAttribute("href", "/assignment/instructor/grader");
    expect(backToCourse).toBeInTheDocument();
    expect(user).toBeInTheDocument();
    expect(grader).not.toHaveAttribute("title");
    expect(backToCourse).not.toHaveAttribute("title");
    expect(user).not.toHaveAttribute("title");
  });

  it("invokes the command when a top-level item is clicked", async () => {
    const command = vi.fn();
    const items: NavItem[] = [
      {
        label: "Grader",
        icon: "check-square",
        href: "/assignment/instructor/grader",
        command
      }
    ];

    renderWithMantine(<AppNavBar items={items} />);
    await userEvent.click(screen.getByRole("link", { name: /grader/i }));

    expect(command).toHaveBeenCalledTimes(1);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey"] as const)(
    "leaves modified clicks to the browser when %s is held",
    (modifier) => {
      const command = vi.fn();
      const items: NavItem[] = [
        {
          label: "Grader",
          href: "/assignment/instructor/grader",
          command
        }
      ];

      renderWithMantine(<AppNavBar items={items} />);
      const link = screen.getByRole("link", { name: /grader/i });

      link.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(link, { [modifier]: true });

      expect(command).not.toHaveBeenCalled();
    }
  );

  it("opens a submenu and invokes a sub-item command", async () => {
    const logout = vi.fn();
    const items: NavItem[] = [
      {
        label: "User",
        icon: "user",
        items: [{ label: "Logout", command: logout }]
      }
    ];

    renderWithMantine(<AppNavBar items={items} />);
    await userEvent.click(screen.getByRole("button", { name: /user/i }));

    const logoutItem = await screen.findByText("Logout");

    await userEvent.click(logoutItem);

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it("renders submenu destinations as links and preserves modified clicks", async () => {
    const command = vi.fn();
    const items: NavItem[] = [
      {
        label: "Help",
        items: [
          {
            label: "Guide",
            href: "https://guide.runestone.academy/",
            command
          }
        ]
      }
    ];

    renderWithMantine(<AppNavBar items={items} />);
    await userEvent.click(screen.getByRole("button", { name: /help/i }));
    const guide = await screen.findByRole("menuitem", { name: /guide/i });

    expect(guide).toHaveAttribute("href", "https://guide.runestone.academy/");
    guide.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(guide, { ctrlKey: true });

    expect(command).not.toHaveBeenCalled();
  });

  it("supports arrow navigation and closes a submenu with Escape", async () => {
    const items: NavItem[] = [
      {
        label: "Help",
        items: [
          { label: "Guide", command: vi.fn() },
          { label: "Contact", command: vi.fn() }
        ]
      }
    ];

    renderWithMantine(<AppNavBar items={items} />);
    const helpButton = screen.getByRole("button", { name: /help/i });

    helpButton.focus();
    await userEvent.keyboard("{Enter}");

    const menu = await screen.findByRole("menu");
    const menuItems = within(menu).getAllByRole("menuitem");

    await userEvent.keyboard("{ArrowDown}");
    expect(menuItems[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(menuItems[1]).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(helpButton).toHaveFocus();
  });

  it("hides sub-items whose visible flag is false", async () => {
    renderWithMantine(<AppNavBar items={makeItems()} />);
    await userEvent.click(screen.getByRole("button", { name: /user/i }));

    expect(await screen.findByText("Logout")).toBeInTheDocument();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("hides top-level items whose visible flag is false", () => {
    const items: NavItem[] = [
      { label: "Shown", command: vi.fn() },
      { label: "Gone", command: vi.fn(), visible: false }
    ];

    renderWithMantine(<AppNavBar items={items} />);

    expect(screen.getByRole("button", { name: /shown/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gone/i })).not.toBeInTheDocument();
  });

  it("does not invoke disabled course items", async () => {
    const command = vi.fn();
    const items: NavItem[] = [
      {
        label: "Course: cs101",
        items: [{ label: "cs102", command, disabled: true }]
      }
    ];

    renderWithMantine(<AppNavBar items={items} />);
    await userEvent.click(screen.getByRole("button", { name: /course: cs101/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /cs102/i }));

    expect(command).not.toHaveBeenCalled();
  });

  it("renders the Runestone logo image alongside the wordmark", () => {
    const { container } = renderWithMantine(<AppNavBar items={makeItems()} />);

    expect(screen.getByText("Runestone")).toBeInTheDocument();

    const logo = container.querySelector("img");

    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/staticAssets/RAIcon.png");
  });

  it("marks the item matching the active path with aria-current", () => {
    const items: NavItem[] = [
      { label: "Grader", command: vi.fn(), activePrefixes: ["/grader"] },
      { label: "Builder", command: vi.fn(), activePrefixes: ["/builder", "/"] }
    ];

    renderWithMantine(<AppNavBar items={items} activePath="/grader/12" />);

    expect(screen.getByRole("button", { name: /grader/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /builder/i })).not.toHaveAttribute("aria-current");
  });

  it("marks no item active when the path matches nothing", () => {
    const items: NavItem[] = [{ label: "Grader", command: vi.fn(), activePrefixes: ["/grader"] }];

    renderWithMantine(<AppNavBar items={items} activePath="/graderOld" />);

    expect(screen.getByRole("button", { name: /grader/i })).not.toHaveAttribute("aria-current");
  });

  it("reflects the scrolled prop on the nav element", () => {
    const { rerender } = renderWithMantine(<AppNavBar items={makeItems()} scrolled={false} />);
    const nav = screen.getByRole("navigation", { name: /main navigation/i });

    expect(nav).not.toHaveAttribute("data-scrolled");

    rerender(<AppNavBar items={makeItems()} scrolled />);

    expect(nav).toHaveAttribute("data-scrolled");
  });

  it("exposes all items through the compact overflow menu", async () => {
    const home = vi.fn();
    const logout = vi.fn();
    const items: NavItem[] = [
      { label: "Home", icon: "home", command: home },
      {
        label: "User",
        icon: "user",
        items: [
          { label: "Logout", command: logout },
          { label: "Hidden", command: vi.fn(), visible: false }
        ]
      }
    ];

    renderWithMantine(<AppNavBar items={items} />);
    await userEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));

    const menu = await screen.findByRole("menu");

    expect(within(menu).getByText("User")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /logout/i })).toBeInTheDocument();
    expect(within(menu).queryByText("Hidden")).not.toBeInTheDocument();

    await userEvent.click(within(menu).getByRole("menuitem", { name: /home/i }));
    await waitFor(() => expect(home).toHaveBeenCalledTimes(1));
  });

  it("renders compact navigation destinations as links", async () => {
    const command = vi.fn();
    const items: NavItem[] = [
      {
        label: "Grader",
        href: "/assignment/instructor/grader",
        command
      }
    ];

    renderWithMantine(<AppNavBar items={items} />);
    await userEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const grader = await screen.findByRole("menuitem", { name: /grader/i });

    expect(grader).toHaveAttribute("href", "/assignment/instructor/grader");
    grader.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(grader, { metaKey: true });

    expect(command).not.toHaveBeenCalled();
  });
});
