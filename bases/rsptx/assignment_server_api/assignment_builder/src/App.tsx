import "./App.css";
import { AppNavBar } from "@components/shell/AppNavBar";
import { useScrollShadow } from "@components/shell/useScrollShadow";
import { useSelector } from "react-redux";
import {
  createBrowserRouter,
  RouterProvider,
  useNavigate,
  useLocation,
  Outlet
} from "react-router-dom";

import { routerService } from "@/router";

import shellStyles from "./components/shell/AppShell.module.css";
import { buildNavBar } from "./navUtils.js";
import AssignmentEditor, { MoreOptions, AddQuestionTabGroup } from "./renderers/assignment.jsx";
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

const FULL_BLEED_ROUTE = /^\/(grader|builder)(\/|$)/;

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sentinelRef, scrolled } = useScrollShadow();
  const items = buildNavBar(window.eBookConfig, navigate);
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
                  async lazy() {
                    const { GraderGradebookPage } = await import("@components/routes/Grader");
                    return { Component: GraderGradebookPage };
                  }
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
