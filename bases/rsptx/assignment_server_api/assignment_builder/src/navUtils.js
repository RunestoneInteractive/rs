export function buildNavBar(eBookConfig) {
  // Mock some eBookConfig values if they are not present
  if (Object.keys(eBookConfig).length === 0) {
    eBookConfig.isInstructor = true;
    eBookConfig.course = "dev mode";
    eBookConfig.username = "developer";
    eBookConfig.isLoggedIn = true;
  }
  const items = [
    {
      label: "Home",
      icon: "pi pi-home",
      url: "/runestone/default/index",
    },
    {
      label: `Back to ${eBookConfig.course || "Course"}`,
      url: "/ns/books/published/" + eBookConfig.course + "/index.html",
    },
    {
      label: "Admin",
      icon: "pi pi-cog",
      url: "admin",
    },
    {
      label: "Grader",
      icon: "pi pi-gauge",
      url: "grader",
    },
    {
      label: "Assignment Builder",
      icon: "pi pi-file-edit",
      url: "builder",
    },
    {
      label: "User",
      icon: "pi pi-user",
      items: [
        {
          label: `Welcome ${eBookConfig.username || "User"}`,
          icon: "pi pi-bolt",
        },
        {
          label: "Course Home",
          icon: "pi pi-home",
          url: "/ns/course/index",
        },
        {
          label: "Assignments",
          icon: "pi pi-pencil",
          url: "/assignment/student/chooseAssignment",
        },
        {
          label: "Practice",
          icon: "pi pi-palette",
          url: "/runestone/assignments/practice",
        },
        eBookConfig.isInstructor
          ? {
              label: "Peer Instruction (Instructor)",
              url: "/runestone/peer/instructor.html",
            }
          : null,
        {
          label: "Peer Instruction (Student)",
          url: "/runestone/peer/student.html",
        },
        {
          separator: true,
        },
        {
          label: "Change Course",
          url: "/runestone/default/courses",
        },
        {
          separator: true,
        },
        {
          label: "Instructors Page",
          url: "/runestone/admin/admin",
        },
        {
          label: "Accommodations",
          icon: "pi pi-ban",
          url: "except",
        },
        {
          label: "Progress Page",
          url: "/runestone/dashboard/studentreport",
        },
        {
          separator: true,
        },
        {
          label: "Edit Profile",
          url: "/runestone/default/user/profile",
        },
        {
          label: "Change Password",
          url: "/runestone/default/user/change_password",
        },
        {
          label: "Logout",
          url: "/runestone/default/user/logout",
        },
      ],
    },
    {
      label: "Help",
      icon: "pi pi-question-circle",
      items: [
        {
          label: "Instructors Guide",
          icon: "pi pi-book",
          url: "https://guide.runestone.academy/",
        },
        {
          label: "Video Tutorials",
          icon: "pi pi-video",
          url: "https://www.youtube.com/playlist?list=PLnjfglXW2QQRG6NRsg5mq8V99MM_3j_ZU",
        },
        {
          label: "Contact Us",
          icon: "pi pi-envelope",
          url: "https://github.com/RunestoneInteractive/rs/issues",
        },
        {
          label: "Join our Discord",
          icon: "pi pi-discord",
          url: "https://discord.gg/f3Qmbk9P3U",
        },
      ],
    },
  ];

  return items;
}
