/* eslint-disable */
/**
 * @file interactiveSlice.js
 * @summary This file defines a slice for the active code editor
 * @description This file contains the slice for the active code editor. The slice manages the state of the active code editor.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import toast from "react-hot-toast";

import { createMCQTemplate } from "../../componentFuncs";
import { addExercise, selectPoints, setId, setPoints } from "../assignment/assignSlice.js";

/**
 * @function saveAssignmentQuestion
 * @summary saveAssignmentQuestion
 * @description This thunk saves the activecode question to the database as well as adding it to the current assignment
 * @param {object} incoming - an object that combines the activecode data and the assignment data and the preview_src
 * @returns {Promise} a promise that resolves to the result of the fetch -- Any thrown by the thunk
 * will result in the promise being rejected and the error will be logged by the builder in extraReducers.
 * @memberof ActiveCodeEditor
 *
 */
export const saveAssignmentQuestion = createAsyncThunk(
  "acEditor/saveAssignmentQuestion",
  // incoming is an object that combines the activecode data and the assignment data and the preview_src
  async (incoming, { getState, dispatch }) => {
    let store = getState();
    let preview_src;
    // temporary fix for multiple choice

    if (store.interactive.question_type === "mchoice") {
      preview_src = createMCQTemplate(
        store.interactive.uniqueId,
        store.multiplechoice.statement,
        store.multiplechoice.optionList
      );
    } else {
      preview_src = store.interactive.preview_src;
    }
    let assignData = incoming.assignData;
    let assignmentId = assignData.id;
    let editonly = incoming.editonly;
    let questionId = 0;

    if (editonly || store.interactive.id) {
      questionId = store.interactive.id;
      editonly = true;
    }
    let questionType = store.interactive.question_type;
    let jsheaders = new Headers({
      "Content-type": "application/json; charset=utf-8",
      Accept: "application/json"
    });
    // Now add the question
    // these names match the database columns
    let body = {
      name: store.interactive.uniqueId,
      source: "This question was written in the web interface",
      question_type: store.interactive.question_type,
      htmlsrc: preview_src,
      question_json: JSON.stringify(store.interactive.question_json),
      chapter: store.interactive.chapter,
      author: store.interactive.author,
      difficulty: store.interactive.difficulty,
      topic: store.interactive.topic,
      tags: store.interactive.tags
    };

    if (editonly) {
      body.id = questionId;
    }
    if (questionType === "activecode" && store.acEditor.suffix_code) {
      body.autograde = "unittest";
    } else {
      if (questionType === "activecode") {
        body.autograde = "manual";
      } else {
        body.autograde = null;
      }
    }
    let data = {
      body: JSON.stringify(body),
      headers: jsheaders,
      method: "POST"
    };
    let resp;

    if (editonly) {
      resp = await fetch("/assignment/instructor/update_question", data);
    } else {
      resp = await fetch("/assignment/instructor/new_question", data);
    }
    if (!resp.ok) {
      let result = await resp.json();

      console.log("Failed to create question", result.detail);
      toast("Failed to create question - Most likely a name conflict", { icon: "🚫" });
      return;
    }
    let result = await resp.json();

    if (result.detail.status === "success") {
      console.log("Question created");
      questionId = result.detail.id;
      dispatch(setDBId(questionId));
    }
    if (editonly) {
      toast("Question saved", { icon: "👍" });
      return;
    }
    let aqBody = {
      assignment_id: assignmentId,
      question_id: questionId,
      points: store.interactive.qpoints
    };
    let allEx = store.assignment.exercises;
    let clen = allEx.length;

    aqBody.which_to_grade = clen ? allEx[allEx.length - 1].which_to_grade : "best_answer";
    aqBody.autograde = body.autograde;
    aqBody.qnumber = body.name;
    aqBody.id = questionId;
    try {
      dispatch(addExercise(aqBody));
    } catch (e) {
      console.error(e);
    }
    dispatch(setPoints(selectPoints(store) + store.interactive.qpoints));
    //finally add the question to the assignment
    // not sure if this is neeeded after the previous dispatch...
    data = {
      body: JSON.stringify(aqBody),
      headers: jsheaders,
      method: "POST"
    };
    resp = await fetch("/assignment/instructor/new_assignment_q", data);
    result = await resp.json();
    if (result.detail.status === "success") {
      console.log("Question added to assignment");
      toast("Question added to assignment", { icon: "👍" });
    }
  }
);
const today = new Date();
const date =
  today.getFullYear() +
  (today.getMonth() + 1).toString().padStart(2, "0") +
  today.getDate().toString().padStart(2, "0");
const randInt = Math.floor(Math.random() * 1000);
const default_id = `question_${date}_${randInt}`;

const interactiveSlice = createSlice({
  name: "interactive",
  initialState: {
    uniqueId: default_id,
    qpoints: 1,
    chapter: "",
    subchapter: "Exercises",
    author: "",
    tags: "",
    question_type: "",
    preview_src: "",
    question_json: {},
    topic: "",
    difficulty: 3
  },
  reducers: {
    setUniqueId: (state, action) => {
      state.uniqueId = action.payload;
    },
    setQpoints: (state, action) => {
      state.qpoints = action.payload;
    },
    setChapter: (state, action) => {
      state.chapter = action.payload;
    },
    setSubchapter: (state, action) => {
      state.subchapter = action.payload;
    },
    setAuthor: (state, action) => {
      state.author = action.payload;
    },
    setTags: (state, action) => {
      // let tags = action.payload.split(",");
      // tags = tags.map((tag) => tag.trim());
      // tags = tags.map((tag) => tag.toLowerCase());
      // state.tags = state.tags.concat(tags);
      state.tags = action.payload;
    },
    setQuestionType: (state, action) => {
      state.question_type = action.payload;
    },
    setPreviewSrc: (state, action) => {
      state.preview_src = action.payload;
    },
    setQuestionJson: (state, action) => {
      state.question_json = action.payload;
    },
    setTopic: (state, action) => {
      state.topic = action.payload;
    },
    setDifficulty: (state, action) => {
      state.difficulty = action.payload;
    },
    setQuestion: (state, action) => {
      state.uniqueId = action.payload.name;
      state.id = action.payload.id;
      state.from_source = action.payload.from_source;
      state.qpoints = action.payload.qpoints;
      state.chapter = action.payload.chapter;
      state.subchapter = action.payload.subchapter;
      state.author = action.payload.author;
      state.tags = action.payload.tags;
      state.question_type = action.payload.question_type;
      state.preview_src = action.payload.preview_src;
      state.question_json = action.payload.question_json;
      state.topic = action.payload.topic;
      state.difficulty = action.payload.difficulty;
    },
    setDBId: (state, action) => {
      state.id = action.payload;
    }
  },
  extraReducers(builder) {
    /* eslint-disable */
    builder
      .addCase(saveAssignmentQuestion.fulfilled, (state, action) => {
        console.log("Question saved");
      })
      .addCase(saveAssignmentQuestion.rejected, (state, action) => {
        console.log("Question save failed", action.error.message);
      });
    /* eslint-enable */
  }
});

export const {
  setUniqueId,
  setQpoints,
  setChapter,
  setSubchapter,
  setAuthor,
  setTags,
  setQuestionType,
  setPreviewSrc,
  setQuestion,
  setQuestionJson,
  setTopic,
  setDifficulty,
  setDBId
} = interactiveSlice.actions;

export const selectUniqueId = (state) => state.interactive.uniqueId;
export const selectQpoints = (state) => state.interactive.qpoints;
export const selectChapter = (state) => state.interactive.chapter;
export const selectSubchapter = (state) => state.interactive.subchapter;
export const selectAuthor = (state) => state.interactive.author;
export const selectTags = (state) => state.interactive.tags;
export const selectQuestionType = (state) => state.interactive.question_type;
export const selectPreviewSrc = (state) => state.interactive.preview_src;
export const selectQuestionJson = (state) => state.interactive.question_json;
export const selectTopic = (state) => state.interactive.topic;
export const selectDifficulty = (state) => state.interactive.difficulty;
export default interactiveSlice.reducer;
