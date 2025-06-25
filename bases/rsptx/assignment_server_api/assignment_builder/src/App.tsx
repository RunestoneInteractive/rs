import "./App.css";
import { DialogContextProvider } from "@components/ui/DialogContext";
import { ToastContextProvider } from "@components/ui/ToastContext";
import { Menubar } from "primereact/menubar";
import { Toaster } from "react-hot-toast";
import { useSelector } from "react-redux";
import {
  createBrowserRouter,
  RouterProvider,
  useSearchParams,
  useNavigate,
  Outlet
} from "react-router-dom";

import { routerService } from "@/router";

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

import "@fortawesome/fontawesome-free/css/all.min.css";
import "katex/dist/katex.min.css";

function OldAssignmentBuilder() {
  const [searchParams] = useSearchParams();
  let assignmentId = searchParams.get("assignment_id");

  console.log("assignmentId: ", assignmentId);

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
        headerTitle="Sections to Read"
        columns={readingColumns}
        columnSpecs={readingColumnSpec}
        isReading={true}
      />
      <AssignmentQuestion
        headerTitle="Graded Exercises"
        columns={problemColumns}
        columnSpecs={problemColumnSpec}
      />
      <AddQuestionTabGroup />
    </>
  );
}

function AssignmentGrader() {
  return (
    <div className="App">
      <h1>Assignment Grader</h1>
      <AssignmentPicker />
      <AssignmentSummary />
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const items = buildNavBar(window.eBookConfig, navigate);
  const start = <img alt="" src="/staticAssets/RAIcon.png" height="30px" />;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden"
      }}
    >
      <Menubar style={{ flexShrink: 0, flexWrap: "nowrap" }} model={items} start={start} />
      <div
        style={{
          flex: "1 1 auto",
          overflow: "auto",
          height: "100%"
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  if (useSelector(selectIsAuthorized) === false) {
    return (
      <div>
        <h1 className="App">Assignment Builder</h1>
        <h2>Error fetching assignments, you may not be authorized.</h2>
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
  console.log("ENV: ", import.meta.env);

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
                let { AssignmentBuilder } = await import("@components/routes/AssignmentBuilder");

                return { Component: AssignmentBuilder };
              }
            },
            {
              path: "builder",
              async lazy() {
                let { AssignmentBuilder } = await import("@components/routes/AssignmentBuilder");

                return { Component: AssignmentBuilder };
              },
              children: [
                {
                  path: "create",
                  async lazy() {
                    let { AssignmentBuilderCreate } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderCreate"
                    );

                    return { Component: AssignmentBuilderCreate };
                  }
                },
                {
                  path: "create/:step",
                  async lazy() {
                    let { AssignmentBuilderCreate } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderCreate"
                    );

                    return { Component: AssignmentBuilderCreate };
                  }
                },
                {
                  path: ":assignmentId",
                  async lazy() {
                    let { AssignmentBuilderEdit } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderEdit"
                    );

                    return { Component: AssignmentBuilderEdit };
                  }
                },
                {
                  path: ":assignmentId/:tab",
                  async lazy() {
                    let { AssignmentBuilderEdit } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderEdit"
                    );

                    return { Component: AssignmentBuilderEdit };
                  }
                },
                {
                  path: ":assignmentId/exercises/:viewMode",
                  async lazy() {
                    let { AssignmentBuilderExercises } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderExercises"
                    );

                    return { Component: AssignmentBuilderExercises };
                  }
                },
                {
                  path: ":assignmentId/exercises/:viewMode/:exerciseType",
                  async lazy() {
                    let { AssignmentBuilderExercises } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderExercises"
                    );

                    return { Component: AssignmentBuilderExercises };
                  }
                },
                {
                  path: ":assignmentId/exercises/:viewMode/:exerciseType/:exerciseSubType",
                  async lazy() {
                    let { AssignmentBuilderExercises } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderExercises"
                    );

                    return { Component: AssignmentBuilderExercises };
                  }
                },
                {
                  path: ":assignmentId/exercises/:viewMode/:exerciseType/:exerciseSubType/:step",
                  async lazy() {
                    let { AssignmentBuilderExercises } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderExercises"
                    );

                    return { Component: AssignmentBuilderExercises };
                  }
                },
                {
                  path: ":assignmentId/exercises/:viewMode/:exerciseType/:step",
                  async lazy() {
                    let { AssignmentBuilderExercises } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderExercises"
                    );

                    return { Component: AssignmentBuilderExercises };
                  }
                },
                {
                  path: ":assignmentId/exercises/edit/:exerciseId",
                  async lazy() {
                    let { AssignmentBuilderExercises } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderExercises"
                    );

                    return { Component: AssignmentBuilderExercises };
                  }
                },
                {
                  path: ":assignmentId/exercises/edit/:exerciseId/:step",
                  async lazy() {
                    let { AssignmentBuilderExercises } = await import(
                      "./components/routes/AssignmentBuilder/components/AssignmentBuilderExercises"
                    );

                    return { Component: AssignmentBuilderExercises };
                  }
                }
              ]
            },
            {
              path: "builderV2",
              element: <OldAssignmentBuilder />
            },
            {
              path: "grader",
              element: <AssignmentGrader />
            },
            {
              path: "admin",
              element: <h1>Coming Soon</h1>
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

  return (
    <ToastContextProvider>
      <DialogContextProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
        <Toaster toastOptions={{ duration: 3000 }} />
      </DialogContextProvider>
    </ToastContextProvider>
  );
}

export default App;
