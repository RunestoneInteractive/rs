/**
 *
 * @fileoverview This file contains the Redux slice for the assignment builder.
 * This is a good place to start if you are looking to understand how the assignment builder
 * interacts with the server.
 *
 * To see the major data, jump to the `assignSlice` object.
 *
 * The first part of this file defines a number of "thunks" which are async functions that can be dispatched
 * to the Redux store. These thunks are used to interact with the server. for example:
 * - `fetchAssignments` is used to get the list of assignments from the server
 * - `createAssignment` is used to create a new assignment on the server
 * - `fetchAssignmentQuestions` is used to get the list of questions associated with an assignment
 * - `sendExercise` is used to add a question to an assignment
 * - `sendDeleteExercises` is used to remove questions from an assignment
 * - `reorderAssignmentQuestions` is used to reorder the questions in an assignment
 * - `sendAssignmentUpdate` is used to update the assignment details
 * - `searchForQuestions` is used to search for questions in the question bank
 * @memberof AssignmentEditor
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";

import { setSelectedNodes } from "../epicker/ePickerSlice";

// thunks can take a single argument. If you need to pass multiple values, pass an object
// thunks can optionally take a second argument which is an object that contains the getState and dispatch
// functions.  You can call getState to get a reference to the Redux store.

/**
 * @function fetchAssignments
 * @memberof AssignmentEditor
 * @description This function is called to initialize the list of assignments.
 * @param {object} getState - the getState function from the Redux store
 * @returns {Promise} - a promise that resolves to the list of assignments
 *
 * When the promise is resolved, the list of assignments is added to the Redux store.
 * Any further actions that need to be taken after the assignments are fetched can be done in the
 * fetchAssignments.fulfilled case of the builder object in the extraReducers method.
 */
export const fetchAssignments = createAsyncThunk(
  "assignment/fetchAssignments",
  async (neededForGetState, { getState, dispatch }) => {
    const response = await fetch("/assignment/instructor/assignments");
    const data = await response.json();
    let state = getState();
    //dispatch(updateField({ field: "exercises", newVal: data }));

    if (!response.ok) {
      console.warn("Error fetching assignments");
      if (response.status === 401) {
        console.warn("Unauthorized to fetch assignments");
        dispatch(setIsAuthorized(false));
        return;
      }
    }
    return data.detail;
  }
);

/**
 * @function createAssignment
 * @param {object} assignData - an object that contains the data for the new assignment
 * @param {object} dispatch - the dispatch function from the Redux store
 * @description This function is called when the user creates a new assignment.
 *
 * Upon success, the function dispatches the setId action to set the id of the new assignment.
 * It also returns a Promise.  When the promise is result any actions that need to be taken after the
 * assignment is created can be done in the createAssignment.fulfilled case of the builder object
 * in the extraReducers method.
 * @memberof AssignmentEditor
 */
export const createAssignment = createAsyncThunk(
  "assignment/createAssignment",
  // incoming is an object that combines the activecode data and the assignment data and the preview_src
  async (assignData, { dispatch }) => {
    let jsheaders = new Headers({
      "Content-type": "application/json; charset=utf-8",
      Accept: "application/json"
    });
    // make a date that is acceptable on the server
    let duedate = new Date(assignData.duedate);

    duedate = duedate.toISOString().replace("Z", "");
    let body = {
      name: assignData.name,
      description: assignData.description,
      duedate: duedate,
      points: assignData.points,
      kind: "quickcode"
    };
    let data = {
      body: JSON.stringify(body),
      headers: jsheaders,
      method: "POST"
    };
    let resp = await fetch("/assignment/instructor/assignments", data);

    if (!resp.ok) {
      console.warn("Error creating assignment");
      if (resp.status === 422) {
        console.warn("Missing data for creating assignment");
        /* The JON response from the server looks like this:
                {
                    "detail": [
                        {
                            "type": "int_parsing",
                            "loc": [
                                "body",
                                "points"
                            ],
                            "msg": "Input should be a valid integer, unable to parse string as an integer",
                            "input": "",
                            "url": "https://errors.pydantic.dev/2.6/v/int_parsing"
                        }
                    ]
                }
                */
        let result = await resp.json();

        toast(`Error ${result.detail[0].msg} for input ${result.detail[0].loc}`, {
          duration: 5000
        });
      } else {
        let result = await resp.json();

        console.error(result.detail);
        toast("Error creating assignment", {
          icon: "🔥",
          duration: 5000
        });
      }

      return;
    }
    toast("Assignment created", { icon: "👍" });
    let result = await resp.json();
    // The result will contain the id assigned to the new assignment

    dispatch(setId(result.detail.id));
    // todo: Add the assignment to the list of all_assignments
    assignData.id = result.detail.id;
    dispatch(addAssignment(assignData));
  }
);

/**
 * @function fetchAssignmentQuestions
 * @param {number} assignmentId - the id of the assignment
 * @param {object} getState - the getState function from the Redux store
 * @param {object} dispatch - the dispatch function from the Redux store
 * @description This function is called to get the questions associated with an assignment.
 * @memberof AssignmentEditor
 */
export const fetchAssignmentQuestions = createAsyncThunk(
  "assignment/fetchAssignmentQuestions",
  async (assignmentId, { getState, dispatch }) => {
    const response = await fetch("/assignment/instructor/assignment_questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ assignment: assignmentId })
    });
    const data = await response.json();
    let store = getState();
    let selectedNodes = {};
    // Not super efficient, but we need to set the selectedNodes for the ePicker
    // maybe better to include more question data with the assignment_questions then we
    // would not have to search.

    for (let ch of store.ePicker.nodes) {
      for (let sc of ch.children) {
        for (let q of sc.children) {
          if (data.detail.exercises.find((d) => d.question_id === q.data.id)) {
            selectedNodes[q.key] = { checked: true, partialChecked: false };
            selectedNodes[q.data.chapter] = { checked: false, partialChecked: true };
            selectedNodes[q.data.subchapter] = { checked: false, partialChecked: true };
          }
        }
      }
    }
    dispatch(setSelectedNodes(selectedNodes));
    return data.detail;
  }
);

/**
 * @function sendExercise
 * @param {object} exercise - an object that contains the data for the new exercise
 * @description This function is called to save the exercise to the database.
 * @memberof AssignmentEditor
 */
export const sendExercise = createAsyncThunk("assignment/sendExercise", async (exercise) => {
  const response = await fetch("/assignment/instructor/assignment_question", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(exercise)
  });
  const data = await response.json();

  return data.detail;
});

/**
 * @function sendDeleteExercises
 * @param {array} exercises - an array of exercises to delete
 * @description This function is called to delete exercises from the database.
 * @memberof AssignmentEditor
 */
export const sendDeleteExercises = createAsyncThunk(
  "assignment/sendDeleteExercises",
  async (exercises) => {
    exercises = exercises.map((ex) => ex.id);
    console.log("deleteExercises", exercises);
    const response = await fetch("/assignment/instructor/remove_assignment_questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(exercises)
    });
    const data = await response.json();

    return data.detail;
  }
);

/**
 * @function reorderAssignmentQuestions
 * @param {array} exercises - an array of exercises to reorder
 * @description This function is called to reorder the exercises in the database.
 * @memberof AssignmentEditor
 */
export const reorderAssignmentQuestions = createAsyncThunk(
  "assignment/reorderAssignmentQuestions",
  async (exercises) => {
    // exercises is an array of assignment_question ids
    const response = await fetch("/assignment/instructor/reorder_assignment_questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(exercises)
    });
    const data = await response.json();

    return data.detail;
  }
);

/**
 * @function sendAssignmentUpdate
 * @param {object} assignment - an object that contains the data for the assignment
 * @description This function is called to update the assignment in the database.
 * @memberof AssignmentEditor
 * @returns {Promise} - a promise that resolves to the result of the fetch
 *
 */
export const sendAssignmentUpdate = createAsyncThunk(
  "assignment/sendAssignmentUpdate",
  // todo missing released, duedate, and from_source
  async (assignment) => {
    const response = await fetch(`/assignment/instructor/assignments/${assignment.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(assignment)
    });

    if (!response.ok) {
      let err = await response.json();

      console.error("Error updating assignment", err.detail);
      return;
    }
    const data = await response.json();

    return data.detail;
  }
);

/**
 * @function searchForQuestions
 * @param {object} searchData - an object that contains the search data
 * @description This function is called to search for questions in the question bank.
 * @memberof AssignmentEditor
 * @returns {Promise} - a promise that resolves to the result of the fetch
 */
export const searchForQuestions = createAsyncThunk(
  "assignment/searchForQuestions",
  async (searchData) => {
    const response = await fetch("/assignment/instructor/search_questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(searchData)
    });
    const data = await response.json();

    return data.detail;
  }
);

let cDate = new Date();
let epoch = cDate.getTime();

epoch = epoch + 60 * 60 * 24 * 7 * 1000;
cDate = new Date(epoch);
let defaultDeadline = cDate.toLocaleString();
// old

// create a slice for Assignments
// This slice must be registered with the store in store.js
/**
 * @memberof AssignmentEditor
 * @description This slice is used to manage the state of the assignment builder.
 * The slice contains the following reducers:
 * - updateField
 * - addExercise
 * - setName
 * - setDesc
 * - setDue
 * - setId
 * - setPoints
 * - setVisible
 * - setIsPeer
 * - setIsTimed
 * - setNoFeedback
 * - setNoPause
 * - setTimeLimit
 * - setPeerAsyncVisible
 * - setFromSource
 * - setReleased
 * - reorderExercise
 * - deleteExercises
 * - updateExercise
 * - addAssignment
 *
 * The slice also contains the following selectors:
 *
 *
 *
 */
/**
 * @type {assignSlice}
 */
/**
 * Creates a Redux slice for managing assignment state.
 *
 * @typedef {Object} AssignSlice
 * @property {string} name - The name of the slice.
 * @property {Object} initialState - The initial state of the slice.
 * @property {number} initialState.id - The ID of the assignment.
 * @property {string} initialState.name - The name of the assignment.
 * @property {string} initialState.desc - The description of the assignment.
 * @property {string} initialState.duedate - The due date of the assignment.
 * @property {number} initialState.points - The total points of the assignment.
 * @property {boolean} initialState.visible - Indicates if the assignment is visible.
 * @property {boolean} initialState.is_peer - Indicates if the assignment is a peer assignment.
 * @property {boolean} initialState.is_timed - Indicates if the assignment is timed.
 * @property {boolean} initialState.nofeedback - Indicates if the assignment has no feedback.
 * @property {boolean} initialState.nopause - Indicates if the assignment has no pause.
 * @property {number|null} initialState.time_limit - The time limit of the assignment.
 * @property {boolean} initialState.peer_async_visible - Indicates if the peer assignment is visible asynchronously.
 * @property {string} initialState.kind - The kind of the assignment (regular, peer, timed).
 * @property {Array} initialState.exercises - The exercises of the assignment.
 * @property {Array} initialState.all_assignments - All assignments.
 * @property {Array} initialState.search_results - The search results.
 * @property {number} initialState.question_count - The count of questions in the assignment.
 * @property {boolean} initialState.isAuthorized - Indicates if the user is authorized.
 * @property {Object} reducers - The reducers for updating the state.
 * @property {Function} reducers.updateField - Updates a field in the state.
 * @property {Function} reducers.setId - Sets the ID of the assignment.
 * @property {Function} reducers.setName - Sets the name of the assignment.
 * @property {Function} reducers.setDesc - Sets the description of the assignment.
 * @property {Function} reducers.setDue - Sets the due date of the assignment.
 * @property {Function} reducers.setVisible - Sets the visibility of the assignment.
 * @property {Function} reducers.setIsPeer - Sets if the assignment is a peer assignment.
 * @property {Function} reducers.setIsTimed - Sets if the assignment is timed.
 * @property {Function} reducers.setNoFeedback - Sets if the assignment has no feedback.
 * @property {Function} reducers.setNoPause - Sets if the assignment has no pause.
 * @property {Function} reducers.setTimeLimit - Sets the time limit of the assignment.
 * @property {Function} reducers.setPeerAsyncVisible - Sets if the peer assignment is visible asynchronously.
 * @property {Function} reducers.setFromSource - Sets the source of the assignment.
 * @property {Function} reducers.setReleased - Sets if the assignment is released.
 * @property {Function} reducers.setExercises - Sets the exercises of the assignment.
 * @property {Function} reducers.addExercise - Adds an exercise to the assignment.
 * @property {Function} reducers.addAssignment - Adds an assignment to the list of all assignments.
 * @property {Function} reducers.setPoints - Sets the total points of the assignment.
 * @property {Function} reducers.updateExercise - Updates an exercise in the assignment.
 * @property {Function} reducers.deleteExercises - Deletes exercises from the assignment.
 * @property {Function} reducers.reorderExercise - Reorders exercises in the assignment.
 * @property {Function} reducers.setSearchResults - Sets the search results.
 * @property {Function} reducers.sumPoints - Calculates the sum of points for the assignment.
 * @property {Object} extraReducers - Additional reducers for handling asynchronous actions.
 */
export const assignSlice = createSlice({
  name: "assignment",
  initialState: {
    id: 0,
    name: "",
    description: "",
    duedate: defaultDeadline,
    points: 1,
    visible: true,
    is_peer: false,
    is_timed: false,
    nofeedback: true,
    nopause: true,
    time_limit: null,
    peer_async_visible: false,
    kind: "Regular", // (regular, peer, timed)
    exercises: [],
    all_assignments: [],
    search_results: [],
    question_count: 0,
    isAuthorized: true,
    released: false,
    selectedAssignments: []
  },
  reducers: {
    updateField: (state, action) => {
      state[action.payload.field] = action.payload.newVal;
    },
    setId: (state, action) => {
      state.id = action.payload;
    },
    setName: (state, action) => {
      state.name = action.payload;
    },
    setDesc: (state, action) => {
      state.description = action.payload;
    },
    setDue: (state, action) => {
      // action.payload is a Date object coming from the date picker or a string from the server
      // convert it to a string and remove the Z because we don't expect timezone information
      if (typeof action.payload === "string") {
        state.duedate = action.payload;
        return;
      }
      state.duedate = action.payload.toISOString().replace("Z", "");
    },
    setVisible: (state, action) => {
      state.visible = action.payload;
    },
    setIsPeer: (state, action) => {
      state.is_peer = action.payload;
    },
    setIsTimed: (state, action) => {
      state.is_timed = action.payload;
    },
    setNoFeedback: (state, action) => {
      state.nofeedback = action.payload;
    },
    setNoPause: (state, action) => {
      state.nopause = action.payload;
    },
    setTimeLimit: (state, action) => {
      state.time_limit = action.payload;
    },
    setPeerAsyncVisible: (state, action) => {
      state.peer_async_visible = action.payload;
    },
    setFromSource: (state, action) => {
      state.from_source = action.payload;
    },
    setKind: (state, action) => {
      state.kind = action.payload;
    },
    setReleased: (state, action) => {
      state.released = action.payload;
    },
    setExercises: (state, action) => {
      state.exercises = action.payload;
    },
    addExercise: (state, action) => {
      console.log("addExercise", action.payload);
      state.exercises.push(action.payload);
    },
    setIsAuthorized: (state, action) => {
      state.isAuthorized = action.payload;
    },
    addAssignment: (state, action) => {
      state.all_assignments.push(action.payload);
    },
    setPoints: (state, action) => {
      state.points = Number(action.payload);
    },
    updateExercise: (state, action) => {
      let idx = state.exercises.findIndex((ex) => ex.id === action.payload.id);

      state.exercises[idx] = action.payload.exercise;
    },
    deleteExercises: (state, action) => {
      let exercises = action.payload;

      console.log("deleteExercises", exercises);
      exercises = exercises.map((ex) => ex.id);
      state.exercises = state.exercises.filter((ex) => !exercises.includes(ex.id));
    },
    reorderExercise: (state, action) => {
      let exOrder = action.payload.exOrder;
      // reorder the state.assignment.exercises array to match the order of the ids in exercises

      state.exercises = exOrder.map((id) => state.exercises.find((ex) => ex.id === id));
      // now renumber the sort_order field in exercises
      state.exercises.forEach((ex, idx) => {
        ex.sorting_priority = idx;
      });
    },
    setSearchResults: (state, action) => {
      state.search_results = action.payload;
    },
    sumPoints: (state, action) => {
      let total = 0;

      for (let ex of state.exercises) {
        total += ex.points;
      }
      if (action.payload && action.payload.adjustment) {
        total += action.payload.adjustment;
      }
      state.points = total;
    },
    setSelected: (state, action) => {
      state.selectedAssignments = action.payload;
    }
  },
  extraReducers(builder) {
    /* eslint-disable */
    builder
      .addCase(fetchAssignments.fulfilled, (state, action) => {
        state.all_assignments = action.payload.assignments;
      })
      .addCase(fetchAssignments.rejected, (state, action) => {
        console.warn("fetchAssignments rejected", action.error.message, action.error.stack);
      })
      .addCase(fetchAssignmentQuestions.fulfilled, (state, action) => {
        for (let ex of action.payload.exercises) {
          ex.required = ex.activities_required;
        }
        state.exercises = action.payload.exercises;
        let total = 0;
        for (let ex of state.exercises) {
          total += ex.points;
        }
        state.points = total;
        console.log("fetchAssignmentQuestions fulfilled");
      })
      .addCase(fetchAssignmentQuestions.rejected, (state, action) => {
        console.warn("fetchAssignmentQuestions rejected", action.error.message, action.error.stack);
      })
      .addCase(sendDeleteExercises.fulfilled, (state, action) => {
        console.log("senddeleteExercises fulfilled");
      })
      .addCase(sendDeleteExercises.rejected, (state, action) => {
        console.warn("sendDeleteExercises rejected", action.error.message, action.error.stack);
      })
      .addCase(reorderAssignmentQuestions.fulfilled, (state, action) => {
        console.log("reorderAssignmentQuestions fulfilled");
      })
      .addCase(reorderAssignmentQuestions.rejected, (state, action) => {
        console.warn(
          "reorderAssignmentQuestions rejected",
          action.error.message,
          action.error.stack
        );
      })
      .addCase(createAssignment.fulfilled, (state, action) => {
        console.log("createAssignment fulfilled");
      })
      .addCase(createAssignment.rejected, (state, action) => {
        console.warn("createAssignment rejected", action.error.message, action.error.stack);
      })
      .addCase(sendAssignmentUpdate.fulfilled, (state, action) => {
        console.log("sendAssignmentUpdate fulfilled");
      })
      .addCase(sendAssignmentUpdate.rejected, (state, action) => {
        console.warn("sendAssignmentUpdate rejected", action.error.message, action.error.stack);
      })
      .addCase(searchForQuestions.fulfilled, (state, action) => {
        console.log("searchForQuestions fulfilled");
        state.search_results = action.payload.questions;
      })
      .addCase(searchForQuestions.rejected, (state, action) => {
        console.warn("searchForQuestions rejected", action.error.message, action.error.stack);
      });
    /* eslint-enable */
  }
});

// export the reducers
export const {
  addAssignment,
  addExercise,
  deleteExercises,
  reorderExercise,
  setDesc,
  setDue,
  setFromSource,
  setId,
  setIsPeer,
  setIsTimed,
  setKind,
  setName,
  setNoFeedback,
  setNoPause,
  setPeerAsyncVisible,
  setPoints,
  setReleased,
  setTimeLimit,
  setVisible,
  sumPoints,
  updateExercise,
  updateField,
  setIsAuthorized,
  setSelected
} = assignSlice.actions;

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
// Note: the state is the global state, followed by the name of the slice (see state.js)
// followed by the name of the field in the slice

export const selectAll = (state) => state.assignment;
export const selectAllAssignments = (state) => state.assignment.all_assignments;
export const selectAssignmentId = (state) => state.assignment.id;
export const selectDesc = (state) => state.assignment.description;
export const selectDue = (state) => state.assignment.duedate;
export const selectExercises = (state) => state.assignment.exercises;
export const selectId = (state) => state.assignment.id;
export const selectIsAuthorized = (state) => state.assignment.isAuthorized;
export const selectIsPeer = (state) => state.assignment.is_peer;
export const selectIsTimed = (state) => state.assignment.is_timed;
export const selectKind = (state) => state.assignment.kind;
export const selectName = (state) => state.assignment.name;
export const selectNoFeedback = (state) => state.assignment.nofeedback;
export const selectNoPause = (state) => state.assignment.nopause;
export const selectPeerAsyncVisible = (state) => state.assignment.peer_async_visible;
export const selectPoints = (state) => state.assignment.points;
export const selectQuestionCount = (state) => state.assignment.question_count;
export const selectSearchResults = (state) => state.assignment.search_results;
export const selectTimeLimit = (state) => state.assignment.time_limit;
export const selectVisible = (state) => state.assignment.visible;
export const selectSelectedAssignments = (state) => state.assignment.selectedAssignments;
export default assignSlice.reducer;
