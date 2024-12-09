import { MenuItem } from "primereact/menuitem";

import { isEmptyObject } from "@/utils/object";

const defaultEBookConfig: EBookConfig = {
  isInstructor: true,
  course: "dev mode",
  username: "developer",
  isLoggedIn: true
};

export const buildNavBar = (eBookConfig: EBookConfig) => {
  const { isInstructor, course, username } = isEmptyObject(eBookConfig)
    ? defaultEBookConfig
    : eBookConfig;

  const items: Array<MenuItem> = [
    {
      label: "Home",
      icon: "pi pi-home",
      url: "/runestone/default/index"
    },
    {
      label: `Back to ${course || "Course"}`,
      url: "/ns/books/published/" + course + "/index.html"
    },
    {
      label: "Admin",
      icon: "pi pi-cog",
      url: "admin"
    },
    {
      label: "Grader",
      icon: "pi pi-gauge",
      url: "grader"
    },
    {
      label: "Assignment Builder",
      icon: "pi pi-file-edit",
      url: "builder"
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
          url: "/ns/course/index"
        },
        {
          label: "Assignments",
          icon: "pi pi-pencil",
          url: "/assignment/student/chooseAssignment"
        },
        {
          label: "Practice",
          icon: "pi pi-palette",
          url: "/runestone/assignments/practice"
        },
        {
          label: "Peer Instruction (Instructor)",
          url: "/runestone/peer/instructor.html",
          visible: isInstructor
        },
        {
          label: "Peer Instruction (Student)",
          url: "/runestone/peer/student.html"
        },
        {
          separator: true
        },
        {
          label: "Change Course",
          url: "/runestone/default/courses"
        },
        {
          separator: true
        },
        {
          label: "Instructors Page",
          url: "/runestone/admin/admin"
        },
        {
          label: "Accommodations",
          icon: "pi pi-ban",
          url: "except"
        },
        {
          label: "Progress Page",
          url: "/runestone/dashboard/studentreport"
        },
        {
          separator: true
        },
        {
          label: "Edit Profile",
          url: "/runestone/default/user/profile"
        },
        {
          label: "Change Password",
          url: "/runestone/default/user/change_password"
        },
        {
          label: "Logout",
          url: "/runestone/default/user/logout"
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
          url: "https://guide.runestone.academy/"
        },
        {
          label: "Video Tutorials",
          icon: "pi pi-video",
          url: "https://www.youtube.com/playlist?list=PLnjfglXW2QQRG6NRsg5mq8V99MM_3j_ZU"
        },
        {
          label: "Contact Us",
          icon: "pi pi-envelope",
          url: "https://github.com/RunestoneInteractive/rs/issues"
        },
        {
          label: "Join our Discord",
          icon: "pi pi-discord",
          url: "https://discord.gg/f3Qmbk9P3U"
        }
      ]
    }
  ];

  return items;
};
