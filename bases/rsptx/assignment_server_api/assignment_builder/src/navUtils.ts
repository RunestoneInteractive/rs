import { MenuItem } from "primereact/menuitem";

import { isEmptyObject } from "@/utils/object";

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

  if (path.startsWith("/runestone") || path.startsWith("/ns") || path.startsWith("/assignment") || path.startsWith("/admin")) {
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

  const items: Array<MenuItem> = [
    {
      label: "Home",
      icon: "pi pi-home",
      command: () => navigateToPath("/runestone/default/index")
    },
    {
      label: `Back to ${course || "Course"}`,
      command: () => navigateToPath("/ns/books/published/" + course + "/index.html")
    },
    {
      label: "Admin",
      icon: "pi pi-cog",
      command: () => navigateToPath("/admin/instructor/menu")
    },
    {
      label: "Grader",
      icon: "pi pi-gauge",
      command: () => navigateToPath("grader")
    },
    {
      label: "Assignment Builder",
      icon: "pi pi-file-edit",
      command: () => navigateToPath("builder")
    },
    {
      label: "User",
      icon: "pi pi-user",
      items: [
        {
          label: `Welcome ${username || "User"}`,
          icon: "pi pi-bolt"
        },
        {
          label: "Course Home",
          icon: "pi pi-home",
          command: () => navigateToPath("/ns/course/index")
        },
        {
          label: "Assignments",
          icon: "pi pi-pencil",
          command: () => navigateToPath("/assignment/student/chooseAssignment")
        },
        {
          label: "Practice",
          icon: "pi pi-palette",
          command: () => navigateToPath("/runestone/assignments/practice")
        },
        {
          label: "Peer Instruction (Instructor)",
          command: () => navigateToPath("/runestone/peer/instructor.html"),
          visible: isInstructor
        },
        {
          label: "Peer Instruction (Student)",
          command: () => navigateToPath("/runestone/peer/student.html")
        },
        {
          separator: true
        },
        {
          label: "Change Course",
          command: () => navigateToPath("/runestone/default/courses")
        },
        {
          separator: true
        },
        {
          label: "Instructors Dashboard",
          command: () => navigateToPath("/admin/instructor/menu")
        },
        {
          label: "Accommodations",
          icon: "pi pi-ban",
          command: () => navigateToPath("except")
        },
        {
          label: "Progress Page",
          command: () => navigateToPath("/runestone/dashboard/studentreport")
        },
        {
          separator: true
        },
        {
          label: "Edit Profile",
          command: () => navigateToPath("/runestone/default/user/profile")
        },
        {
          label: "Change Password",
          command: () => navigateToPath("/runestone/default/user/change_password")
        },
        {
          label: "Logout",
          command: () => navigateToPath("/runestone/default/user/logout")
        }
      ]
    },
    {
      label: "Help",
      icon: "pi pi-question-circle",
      items: [
        {
          label: "Instructors Guide",
          icon: "pi pi-book",
          command: () => navigateToPath("https://guide.runestone.academy/")
        },
        {
          label: "Video Tutorials",
          icon: "pi pi-video",
          command: () =>
            navigateToPath(
              "https://www.youtube.com/playlist?list=PLnjfglXW2QQRG6NRsg5mq8V99MM_3j_ZU"
            )
        },
        {
          label: "Contact Us",
          icon: "pi pi-envelope",
          command: () => navigateToPath("https://github.com/RunestoneInteractive/rs/issues")
        },
        {
          label: "Join our Discord",
          icon: "pi pi-discord",
          command: () => navigateToPath("https://discord.gg/f3Qmbk9P3U")
        }
      ]
    }
  ];

  return items;
};
