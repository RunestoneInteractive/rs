import { AppNavBar } from "@components/shell/AppNavBar";
import { useScrollShadow } from "@components/shell/useScrollShadow";
import {
  useGetRecentInstructorCoursesQuery,
  useSwitchInstructorCourseMutation
} from "@store/course/course.logic.api";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  useNavigate
} from "react-router-dom";
import "./App.css";

import { routerService } from "@/router";

import shellStyles from "./components/shell/AppShell.module.css";
import {
  getRestoredCourseDestination,
  markCourseSwitch,
  reconcileServerCourse,
  syncCourseHistoryEntry
} from "./courseHistory";
import { buildNavBar, getCourseSwitchDestination } from "./navUtils.js";
import AssignmentEditor, { AddQuestionTabGroup, MoreOptions } from "./renderers/assignment.jsx";
import { AssignmentPicker } from "./renderers/assignmentPicker.jsx";
import {
  AssignmentQuestion,
  problemColumnSpec,
  problemColumns,
  readingColumnSpec,
  readingColumns
} from "./renderers/assignmentQuestion.jsx";
import { AssignmentSummary } from "./renderers/assignmentSummary.jsx";
import { ExceptionScheduler } from "./renderers/exceptionScheduler.jsx";
import { selectIsAuthorized } from "./state/assignment/assignSlice.js";

import "katex/dist/katex.min.css";

function OldAssignmentBuilder() {
  return (
    <>
      {" "}
      <div className="App card flex justify-content-center">
        <h1 className="App" style={{ marginBottom: "1rem" }}>
          Assignment Builder
        </h1>
      </div>
      <AssignmentEditor />
      <MoreOptions />
      <AssignmentQuestion
        headerTitle="Sections to read"
        columns={readingColumns}
        columnSpecs={readingColumnSpec}
        isReading={true}
      />
      <AssignmentQuestion
        headerTitle="Graded exercises"
        columns={problemColumns}
        columnSpecs={problemColumnSpec}
      />
      <AddQuestionTabGroup />
    </>
  );
}

function AssignmentGraderOld() {
  return (
    <div className="App">
      <h1>Assignment grader (legacy)</h1>
      <AssignmentPicker />
      <AssignmentSummary />
    </div>
  );
}

const FULL_BLEED_ROUTE = /^\/(grader|gradebook|builder)(\/|$)/;

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sentinelRef, scrolled } = useScrollShadow();
  const { data: instructorCourses = [], refetch: refetchInstructorCourses } =
    useGetRecentInstructorCoursesQuery(undefined, {
      skip: window.eBookConfig.isInstructor === false
    });
  const [switchInstructorCourse, { isLoading: isSwitchingCourse }] =
    useSwitchInstructorCourseMutation();
  const currentCourse = window.eBookConfig.course ?? "";
  const serverCourse = instructorCourses.find(({ is_current }) => is_current)?.course_name;

  useEffect(() => {
    const redirectToServerCourse = (courseName: string | undefined): boolean => {
      const destination = reconcileServerCourse(currentCourse, courseName, location.pathname);

      if (!destination) return false;

      window.location.replace(destination);
      return true;
    };

    if (redirectToServerCourse(serverCourse)) return;

    const destination = syncCourseHistoryEntry(currentCourse, location.pathname);

    if (destination) {
      window.location.replace(destination);
      return;
    }

    let cancelled = false;
    const handlePageShow = async (event: PageTransitionEvent) => {
      if (event.persisted && window.eBookConfig.isInstructor !== false) {
        try {
          const refreshed = await refetchInstructorCourses();

          if (cancelled) return;

          const restoredServerCourse = refreshed.data?.find(
            ({ is_current }) => is_current
          )?.course_name;

          if (redirectToServerCourse(restoredServerCourse)) return;
        } catch {
          // Fall back to the local history checks when the refresh is unavailable.
        }
      }

      const restoredDestination = getRestoredCourseDestination(
        event.persisted,
        currentCourse,
        location.pathname
      );

      if (restoredDestination) {
        window.location.replace(restoredDestination);
      }
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [currentCourse, location.key, location.pathname, refetchInstructorCourses, serverCourse]);

  const handleCourseSwitch = async (courseName: string) => {
    try {
      await switchInstructorCourse(courseName).unwrap();
      markCourseSwitch(courseName);
      window.location.replace(getCourseSwitchDestination(location.pathname));
    } catch {
      return;
    }
  };
  const items = buildNavBar(window.eBookConfig, navigate, {
    courses: instructorCourses,
    onSwitch: handleCourseSwitch,
    isSwitching: isSwitchingCourse
  });
  const isFullBleedRoute = FULL_BLEED_ROUTE.test(location.pathname);

  return (
    <div className={shellStyles.shell}>
      <AppNavBar items={items} activePath={location.pathname} scrolled={scrolled} />
      <main className={`appGradientBg ${shellStyles.content}`}>
        <div ref={sentinelRef} className={shellStyles.scrollSentinel} aria-hidden="true" />
        {isFullBleedRoute ? (
          <Outlet />
        ) : (
          <div className={shellStyles.routeContainer}>
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  if (useSelector(selectIsAuthorized) === false) {
    return (
      <div>
        <h1 className="App">Assignment Builder</h1>
        <h2>Couldn&apos;t load assignments. You may not have instructor access. Sign in again.</h2>
      </div>
    );
  }

  /**
   * The main router for the application.
   * HashRouter is not recommended, but seems like the easiest way
   * to get routing to work with the docker setup.  This allows us to
   * load index.html as served by FastAPI static files but access the routes
   * in the app.
   * For example
   * http://localhost:5173/index.html#/grader for the grader or
   * http://localhost:5173/index.html#/ for the assignment builder.
   * although http://localhost:5173/index.html also works.
   * If one was to go back to a BrowserRouter then you would need to
   * add back in the basename attribute to the BrowserRouter.
   * basename={import.meta.env.BASE_URL}
   */
  const router = routerService.init(
    createBrowserRouter(
      [
        {
          path: "/",
          element: <AppContent />,
          children: [
            {
              index: true,
              async lazy() {
                const { AssignmentBuilder } = await import("@components/routes/AssignmentBuilder");

                return { Component: AssignmentBuilder };
              }
            },
            {
              path: "builder",
              async lazy() {
                const { AssignmentBuilder } = await import("@components/routes/AssignmentBuilder");

                return { Component: AssignmentBuilder };
              },
              children: [
                { path: "create", element: null },
                { path: "create/:step", element: null },
                { path: ":assignmentId", element: null },
                { path: ":assignmentId/:tab", element: null },
                { path: ":assignmentId/exercises/:viewMode", element: null },
                { path: ":assignmentId/exercises/:viewMode/:exerciseType", element: null },
                {
                  path: ":assignmentId/exercises/:viewMode/:exerciseType/:exerciseSubType",
                  element: null
                },
                {
                  path: ":assignmentId/exercises/:viewMode/:exerciseType/:exerciseSubType/:step",
                  element: null
                },
                { path: ":assignmentId/exercises/:viewMode/:exerciseType/:step", element: null },
                { path: ":assignmentId/exercises/edit/:exerciseId", element: null },
                { path: ":assignmentId/exercises/edit/:exerciseId/:step", element: null }
              ]
            },
            {
              path: "builderV2",
              element: <OldAssignmentBuilder />
            },
            {
              path: "grader",
              async lazy() {
                const { Grader } = await import("@components/routes/Grader");

                return { Component: Grader };
              },
              children: [
                {
                  index: true,
                  async lazy() {
                    const { GraderAssignmentsPage } = await import("@components/routes/Grader");

                    return { Component: GraderAssignmentsPage };
                  }
                },
                {
                  path: "gradebook",
                  element: <Navigate to="/gradebook" replace />
                },
                {
                  path: ":assignmentId",
                  async lazy() {
                    const { GraderQuestionsPage } = await import("@components/routes/Grader");

                    return { Component: GraderQuestionsPage };
                  }
                },
                {
                  path: ":assignmentId/questions/:questionId",
                  async lazy() {
                    const { GraderQuestionPage } = await import("@components/routes/Grader");

                    return { Component: GraderQuestionPage };
                  }
                },
                {
                  path: ":assignmentId/questions/:questionId/students/:sid",
                  async lazy() {
                    const { GraderQuestionPage } = await import("@components/routes/Grader");

                    return { Component: GraderQuestionPage };
                  }
                },
                {
                  path: ":assignmentId/questions/:questionId/:sid",
                  async lazy() {
                    const { GraderQuestionPage } = await import("@components/routes/Grader");

                    return { Component: GraderQuestionPage };
                  }
                }
              ]
            },
            {
              path: "gradebook",
              async lazy() {
                const { Grader } = await import("@components/routes/Grader");

                return { Component: Grader };
              },
              children: [
                {
                  index: true,
                  async lazy() {
                    const { GraderGradebookPage } = await import("@components/routes/Grader");

                    return { Component: GraderGradebookPage };
                  }
                }
              ]
            },
            {
              path: "graderOld",
              element: <AssignmentGraderOld />
            },
            {
              path: "admin",
              element: <h1>Coming soon</h1>
            },
            {
              path: "except",
              element: <ExceptionScheduler />
            }
          ]
        }
      ],
      {
        basename: import.meta.env.VITE_BASE_URL
      }
    )
  );

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

export default App;
