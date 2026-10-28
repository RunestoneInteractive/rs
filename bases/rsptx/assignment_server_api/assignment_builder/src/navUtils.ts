import { PrimeIconName } from "@components/ui/Icon";

import { isEmptyObject } from "@/utils/object";

export interface NavItem {
  label?: string;
  icon?: PrimeIconName;
  href?: string;
  command?: () => void;
  items?: NavItem[];
  visible?: boolean;
  separator?: boolean;
  activePrefixes?: string[];
  disabled?: boolean;
}

export interface CourseSwitcherOptions {
  courses: Array<{ course_name: string; is_current: boolean }>;
  onSwitch: (courseName: string) => void;
  isSwitching?: boolean;
}

export const isNavItemActive = (item: NavItem, pathname: string): boolean =>
  !!item.activePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const getCourseSwitchDestination = (pathname: string): string => {
  const isGraderRoute =
    pathname === "/grader" ||
    pathname.startsWith("/grader/") ||
    pathname === "/gradebook" ||
    pathname.startsWith("/gradebook/");

  return isGraderRoute ? "/assignment/instructor/grader" : "/assignment/instructor/builder";
};

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

export const buildNavBar = (
  eBookConfig: EBookConfig,
  navigate?: (path: string) => void,
  courseSwitcher?: CourseSwitcherOptions
) => {
  const { isInstructor, course, username } = isEmptyObject(eBookConfig)
    ? defaultEBookConfig
    : eBookConfig;

  const navigateToPath = createNavigateToPath(navigate);

  const courseItems: NavItem[] = courseSwitcher
    ? courseSwitcher.courses.map((availableCourse) => ({
        label: availableCourse.course_name,
        icon: availableCourse.is_current ? "check" : undefined,
        command: availableCourse.is_current
          ? undefined
          : () => courseSwitcher.onSwitch(availableCourse.course_name),
        disabled: availableCourse.is_current || courseSwitcher.isSwitching
      }))
    : [];

  if (courseItems.length === 0) {
    courseItems.unshift({ label: course || "Current course", icon: "check", disabled: true });
  }

  const items: Array<NavItem> = [
    {
      label: `Course: ${course || "Course"}`,
      icon: "book",
      items: courseItems
    },
    {
      label: `Back to ${course || "Course"}`,
      href: `/ns/books/published/${course}/index.html`,
      command: () => navigateToPath("/ns/books/published/" + course + "/index.html")
    },
    {
      label: "Dashboard",
      icon: "cog",
      href: "/admin/instructor/menu",
      command: () => navigateToPath("/admin/instructor/menu")
    },
    {
      label: "Grader",
      icon: "check-square",
      href: "/assignment/instructor/grader",
      command: () => navigateToPath("grader"),
      activePrefixes: ["/grader"]
    },
    {
      label: "Assignment Builder",
      icon: "file-edit",
      href: "/assignment/instructor/builder",
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
          href: "/ns/course/index",
          command: () => navigateToPath("/ns/course/index")
        },
        {
          label: "Assignments",
          icon: "pencil",
          href: "/assignment/student/chooseAssignment",
          command: () => navigateToPath("/assignment/student/chooseAssignment")
        },
        {
          label: "Practice",
          icon: "palette",
          href: "/runestone/assignments/practice",
          command: () => navigateToPath("/runestone/assignments/practice")
        },
        {
          label: "Peer instruction (instructor)",
          href: "/assignment/peer/instructor",
          command: () => navigateToPath("/assignment/peer/instructor"),
          visible: isInstructor
        },
        {
          label: "Peer instruction (student)",
          href: "/assignment/peer/student",
          command: () => navigateToPath("/assignment/peer/student")
        },
        {
          separator: true
        },
        {
          label: "Change course",
          href: "/admin/auth/my_courses",
          command: () => navigateToPath("/admin/auth/my_courses")
        },
        {
          separator: true
        },
        {
          label: "Instructor's dashboard",
          href: "/admin/instructor/menu",
          command: () => navigateToPath("/admin/instructor/menu")
        },
        {
          label: "Accommodations",
          icon: "ban",
          href: "/assignment/instructor/except",
          command: () => navigateToPath("except")
        },
        {
          label: "Progress page",
          href: "/assignment/student/studentreport",
          command: () => navigateToPath("/assignment/student/studentreport")
        },
        {
          separator: true
        },
        {
          label: "Edit profile",
          href: "/admin/auth/profile",
          command: () => navigateToPath("/admin/auth/profile")
        },
        {
          label: "Change password",
          href: "/runestone/default/user/change_password",
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
          href: "https://guide.runestone.academy/",
          command: () => navigateToPath("https://guide.runestone.academy/")
        },
        {
          label: "Video tutorials",
          icon: "video",
          href: "https://www.youtube.com/playlist?list=PLnjfglXW2QQRG6NRsg5mq8V99MM_3j_ZU",
          command: () =>
            navigateToPath(
              "https://www.youtube.com/playlist?list=PLnjfglXW2QQRG6NRsg5mq8V99MM_3j_ZU"
            )
        },
        {
          label: "Contact us",
          icon: "envelope",
          href: "https://github.com/RunestoneInteractive/rs/issues",
          command: () => navigateToPath("https://github.com/RunestoneInteractive/rs/issues")
        },
        {
          label: "Join our Discord",
          icon: "discord",
          href: "https://discord.gg/f3Qmbk9P3U",
          command: () => navigateToPath("https://discord.gg/f3Qmbk9P3U")
        }
      ]
    }
  ];

  return items;
};
