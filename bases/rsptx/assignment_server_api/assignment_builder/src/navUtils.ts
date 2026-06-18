import { PrimeIconName } from "@components/ui/Icon";

import { isEmptyObject } from "@/utils/object";

export interface NavItem {
  label?: string;
  icon?: PrimeIconName;
  command?: () => void;
  items?: NavItem[];
  visible?: boolean;
  separator?: boolean;
  activePrefixes?: string[];
}

export const isNavItemActive = (item: NavItem, pathname: string): boolean =>
  !!item.activePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const defaultEBookConfig: EBookConfig = {
  isInstructor: true,
  course: "dev mode",
  username: "developer",
  isLoggedIn: true
};

const createNavigateToPath = (navigate?: (path: string) => void) => (path: string) => {
  if (path.startsWith("http")) {
    window.open(path, "_blank");
    return;
  }

  if (
    path.startsWith("/runestone") ||
    path.startsWith("/ns") ||
    path.startsWith("/assignment") ||
    path.startsWith("/admin")
  ) {
    window.location.href = path;
    return;
  }
  console.debug("Navigating to path:", path);
  if (navigate) {
    navigate(`/${path}`);
  } else {
    const cleanPath = path.startsWith("/") ? path : `/#/${path}`;

    window.location.hash = cleanPath.replace("/#/", "#/");
  }
};

export const buildNavBar = (eBookConfig: EBookConfig, navigate?: (path: string) => void) => {
  const { isInstructor, course, username } = isEmptyObject(eBookConfig)
    ? defaultEBookConfig
    : eBookConfig;

  const navigateToPath = createNavigateToPath(navigate);

  const items: Array<NavItem> = [
    {
      label: "Home",
      icon: "home",
      command: () => navigateToPath("/runestone/default/index")
    },
    {
      label: `Back to ${course || "Course"}`,
      command: () => navigateToPath("/ns/books/published/" + course + "/index.html")
    },
    {
      label: "Dashboard",
      icon: "cog",
      command: () => navigateToPath("/admin/instructor/menu")
    },
    {
      label: "Grader",
      icon: "check-square",
      command: () => navigateToPath("grader"),
      activePrefixes: ["/grader"]
    },
    {
      label: "Assignment Builder",
      icon: "file-edit",
      command: () => navigateToPath("builder"),
      activePrefixes: ["/builder", "/"]
    },
    {
      label: "User",
      icon: "user",
      items: [
        {
          label: `Welcome ${username || "User"}`,
          icon: "bolt"
        },
        {
          label: "Course home",
          icon: "home",
          command: () => navigateToPath("/ns/course/index")
        },
        {
          label: "Assignments",
          icon: "pencil",
          command: () => navigateToPath("/assignment/student/chooseAssignment")
        },
        {
          label: "Practice",
          icon: "palette",
          command: () => navigateToPath("/runestone/assignments/practice")
        },
        {
          label: "Peer instruction (instructor)",
          command: () => navigateToPath("/assignment/peer/instructor"),
          visible: isInstructor
        },
        {
          label: "Peer instruction (student)",
          command: () => navigateToPath("/assignment/peer/student")
        },
        {
          separator: true
        },
        {
          label: "Change course",
          command: () => navigateToPath("/admin/auth/my_courses")
        },
        {
          separator: true
        },
        {
          label: "Instructor's dashboard",
          command: () => navigateToPath("/admin/instructor/menu")
        },
        {
          label: "Accommodations",
          icon: "ban",
          command: () => navigateToPath("except")
        },
        {
          label: "Progress page",
          command: () => navigateToPath("/runestone/dashboard/studentreport")
        },
        {
          separator: true
        },
        {
          label: "Edit profile",
          command: () => navigateToPath("/admin/auth/profile")
        },
        {
          label: "Change password",
          command: () => navigateToPath("/runestone/default/user/change_password")
        },
        {
          label: "Logout",
          command: () => navigateToPath("/admin/auth/logout")
        }
      ]
    },
    {
      label: "Help",
      icon: "question-circle",
      items: [
        {
          label: "Instructor's guide",
          icon: "book",
          command: () => navigateToPath("https://guide.runestone.academy/")
        },
        {
          label: "Video tutorials",
          icon: "video",
          command: () =>
            navigateToPath(
              "https://www.youtube.com/playlist?list=PLnjfglXW2QQRG6NRsg5mq8V99MM_3j_ZU"
            )
        },
        {
          label: "Contact us",
          icon: "envelope",
          command: () => navigateToPath("https://github.com/RunestoneInteractive/rs/issues")
        },
        {
          label: "Join our Discord",
          icon: "discord",
          command: () => navigateToPath("https://discord.gg/f3Qmbk9P3U")
        }
      ]
    }
  ];

  return items;
};
