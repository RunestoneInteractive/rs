import { buildNavBar, isNavItemActive, NavItem } from "./navUtils";

const makeConfig = (overrides: EBookConfig = {}): EBookConfig => ({
  isInstructor: true,
  course: "test-course",
  username: "test-user",
  isLoggedIn: true,
  ...overrides
});

describe("buildNavBar", () => {
  let originalOpen: typeof window.open;
  let originalLocationHref: PropertyDescriptor | undefined;
  let originalLocationHash: PropertyDescriptor | undefined;
  let openSpy: ReturnType<typeof vi.fn>;
  let hrefSpy: ReturnType<typeof vi.fn>;
  let hashSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalOpen = window.open;
    openSpy = vi.fn();
    window.open = openSpy;

    hrefSpy = vi.fn();
    hashSpy = vi.fn();

    originalLocationHref = Object.getOwnPropertyDescriptor(window, "location");

    const locationValue: Record<string, unknown> = {};
    Object.defineProperty(locationValue, "href", {
      configurable: true,
      get() {
        return this._href ?? "";
      },
      set(v: string) {
        hrefSpy(v);
        this._href = v;
      }
    });
    Object.defineProperty(locationValue, "hash", {
      configurable: true,
      get() {
        return this._hash ?? "";
      },
      set(v: string) {
        hashSpy(v);
        this._hash = v;
      }
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: locationValue
    });
  });

  afterEach(() => {
    window.open = originalOpen;
    if (originalLocationHref) {
      Object.defineProperty(window, "location", originalLocationHref);
    }
    vi.restoreAllMocks();
  });

  describe("menu structure", () => {
    it("returns an array of menu items", () => {
      const items = buildNavBar(makeConfig());
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it("includes Home, Dashboard, Grader, Assignment Builder, User, and Help labels", () => {
      const items = buildNavBar(makeConfig());
      const topLabels = items.map((i) => i.label);
      expect(topLabels).toContain("Home");
      expect(topLabels).toContain("Dashboard");
      expect(topLabels).toContain("Grader");
      expect(topLabels).toContain("Assignment Builder");
      expect(topLabels).toContain("User");
      expect(topLabels).toContain("Help");
    });

    it("includes a Back to Course item using the course name from config", () => {
      const items = buildNavBar(makeConfig({ course: "my-course" }));
      const backItem = items.find((i) => i.label?.includes("my-course"));
      expect(backItem).toBeDefined();
    });

    it("uses fallback course label when course is empty string", () => {
      const items = buildNavBar(makeConfig({ course: "" }));
      const backItem = items.find((i) => i.label?.includes("Course"));
      expect(backItem).toBeDefined();
    });

    it("uses default eBookConfig values when an empty object is provided", () => {
      const items = buildNavBar({} as EBookConfig);
      const backItem = items.find((i) => i.label?.includes("dev mode"));
      expect(backItem).toBeDefined();
    });
  });

  describe("User sub-menu", () => {
    it("includes Welcome label with username from config", () => {
      const items = buildNavBar(makeConfig({ username: "alice" }));
      const userMenu = items.find((i) => i.label === "User");
      const subItems = (userMenu?.items as Array<{ label?: string }>) ?? [];
      const welcome = subItems.find((s) => s.label?.startsWith("Welcome"));
      expect(welcome?.label).toBe("Welcome alice");
    });

    it("falls back to 'User' in welcome label when username is empty", () => {
      const items = buildNavBar(makeConfig({ username: "" }));
      const userMenu = items.find((i) => i.label === "User");
      const subItems = (userMenu?.items as Array<{ label?: string }>) ?? [];
      const welcome = subItems.find((s) => s.label?.startsWith("Welcome"));
      expect(welcome?.label).toBe("Welcome User");
    });

    it("sets Peer Instruction (Instructor) visible when isInstructor is true", () => {
      const items = buildNavBar(makeConfig({ isInstructor: true }));
      const userMenu = items.find((i) => i.label === "User");
      const subItems = (userMenu?.items as Array<{ label?: string; visible?: boolean }>) ?? [];
      const peerInstructor = subItems.find((s) => s.label === "Peer instruction (instructor)");
      expect(peerInstructor?.visible).toBe(true);
    });

    it("sets Peer Instruction (Instructor) not visible when isInstructor is false", () => {
      const items = buildNavBar(makeConfig({ isInstructor: false }));
      const userMenu = items.find((i) => i.label === "User");
      const subItems = (userMenu?.items as Array<{ label?: string; visible?: boolean }>) ?? [];
      const peerInstructor = subItems.find((s) => s.label === "Peer instruction (instructor)");
      expect(peerInstructor?.visible).toBe(false);
    });
  });

  describe("navigation behavior — http paths", () => {
    it("opens http URLs in a new tab", () => {
      const items = buildNavBar(makeConfig());
      const helpMenu = items.find((i) => i.label === "Help");
      const subItems = (helpMenu?.items as Array<{ label?: string; command?: () => void }>) ?? [];
      const guide = subItems.find((s) => s.label === "Instructor's guide");
      guide?.command?.();
      expect(openSpy).toHaveBeenCalledWith("https://guide.runestone.academy/", "_blank");
    });

    it("opens https URLs in a new tab", () => {
      const items = buildNavBar(makeConfig());
      const helpMenu = items.find((i) => i.label === "Help");
      const subItems = (helpMenu?.items as Array<{ label?: string; command?: () => void }>) ?? [];
      const discord = subItems.find((s) => s.label === "Join our Discord");
      discord?.command?.();
      expect(openSpy).toHaveBeenCalledWith("https://discord.gg/f3Qmbk9P3U", "_blank");
    });
  });

  describe("navigation behavior — server paths", () => {
    it("sets window.location.href for /runestone paths", () => {
      const items = buildNavBar(makeConfig());
      const home = items.find((i) => i.label === "Home");
      home?.command?.();
      expect(hrefSpy).toHaveBeenCalledWith("/runestone/default/index");
    });

    it("sets window.location.href for /ns paths", () => {
      const items = buildNavBar(makeConfig({ course: "cs101" }));
      const back = items.find((i) => i.label?.startsWith("Back to"));
      back?.command?.();
      expect(hrefSpy).toHaveBeenCalledWith("/ns/books/published/cs101/index.html");
    });

    it("sets window.location.href for /assignment paths", () => {
      const items = buildNavBar(makeConfig());
      const userMenu = items.find((i) => i.label === "User");
      const subItems = (userMenu?.items as Array<{ label?: string; command?: () => void }>) ?? [];
      const assignments = subItems.find((s) => s.label === "Assignments");
      assignments?.command?.();
      expect(hrefSpy).toHaveBeenCalledWith("/assignment/student/chooseAssignment");
    });

    it("sets window.location.href for /admin paths", () => {
      const items = buildNavBar(makeConfig());
      const dashboard = items.find((i) => i.label === "Dashboard");
      dashboard?.command?.();
      expect(hrefSpy).toHaveBeenCalledWith("/admin/instructor/menu");
    });
  });

  describe("navigation behavior — hash-based SPA paths (no navigate fn)", () => {
    it("sets window.location.hash for relative paths when no navigate fn is provided", () => {
      const items = buildNavBar(makeConfig());
      const grader = items.find((i) => i.label === "Grader");
      grader?.command?.();
      expect(hashSpy).toHaveBeenCalledWith("#/grader");
    });

    it("sets window.location.hash for builder path", () => {
      const items = buildNavBar(makeConfig());
      const builder = items.find((i) => i.label === "Assignment Builder");
      builder?.command?.();
      expect(hashSpy).toHaveBeenCalledWith("#/builder");
    });
  });

  describe("navigation behavior — React Router navigate fn", () => {
    it("calls navigate with prefixed path when navigate fn is provided", () => {
      const navigate = vi.fn();
      const items = buildNavBar(makeConfig(), navigate);
      const grader = items.find((i) => i.label === "Grader");
      grader?.command?.();
      expect(navigate).toHaveBeenCalledWith("/grader");
    });

    it("calls navigate with prefixed builder path", () => {
      const navigate = vi.fn();
      const items = buildNavBar(makeConfig(), navigate);
      const builder = items.find((i) => i.label === "Assignment Builder");
      builder?.command?.();
      expect(navigate).toHaveBeenCalledWith("/builder");
    });

    it("still uses window.location.href for server paths even with navigate fn", () => {
      const navigate = vi.fn();
      const items = buildNavBar(makeConfig(), navigate);
      const home = items.find((i) => i.label === "Home");
      home?.command?.();
      expect(hrefSpy).toHaveBeenCalledWith("/runestone/default/index");
      expect(navigate).not.toHaveBeenCalled();
    });

    it("still opens http URLs in new tab even with navigate fn", () => {
      const navigate = vi.fn();
      const items = buildNavBar(makeConfig(), navigate);
      const helpMenu = items.find((i) => i.label === "Help");
      const subItems = (helpMenu?.items as Array<{ label?: string; command?: () => void }>) ?? [];
      const guide = subItems.find((s) => s.label === "Instructor's guide");
      guide?.command?.();
      expect(openSpy).toHaveBeenCalledWith("https://guide.runestone.academy/", "_blank");
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("active prefixes", () => {
    it("assigns activePrefixes to the Grader and Assignment Builder items", () => {
      const items = buildNavBar(makeConfig());
      const grader = items.find((i) => i.label === "Grader");
      const builder = items.find((i) => i.label === "Assignment Builder");

      expect(grader?.activePrefixes).toEqual(["/grader"]);
      expect(builder?.activePrefixes).toEqual(["/builder", "/"]);
    });
  });
});

describe("isNavItemActive", () => {
  const grader: NavItem = { label: "Grader", activePrefixes: ["/grader"] };
  const builder: NavItem = { label: "Builder", activePrefixes: ["/builder", "/"] };

  it("matches the prefix exactly", () => {
    expect(isNavItemActive(grader, "/grader")).toBe(true);
  });

  it("matches nested paths under the prefix", () => {
    expect(isNavItemActive(grader, "/grader/12/questions/5")).toBe(true);
  });

  it("does not match a sibling route sharing the prefix string", () => {
    expect(isNavItemActive(grader, "/graderOld")).toBe(false);
  });

  it("matches the root path only exactly", () => {
    expect(isNavItemActive(builder, "/")).toBe(true);
    expect(isNavItemActive(grader, "/")).toBe(false);
  });

  it("matches any of multiple prefixes", () => {
    expect(isNavItemActive(builder, "/builder/7/exercises")).toBe(true);
  });

  it("returns false for items without activePrefixes", () => {
    expect(isNavItemActive({ label: "Home" }, "/builder")).toBe(false);
  });
});
