import { createAsyncThunk, createSlice, createSelector } from "@reduxjs/toolkit";
import { toast } from "react-hot-toast";

export const fetchClassRoster = createAsyncThunk(
  "student/fetchClassRoster",
  // incoming is an object that has keys for skipreading, from_source_only, and pages_only
  // and a value that is a boolean  This can be used for search results for reading questions
  // or for problem sets.
  async () => {
    let jsheaders = new Headers({
      "Content-type": "application/json; charset=utf-8",
      Accept: "application/json"
    });
    let data = {
      headers: jsheaders,
      method: "GET"
    };
    let resp = await fetch("/assignment/instructor/course_roster", data);

    if (!resp.ok) {
      console.warn("Error fetching student roster");
      toast("Error fetching students", {
        icon: "🔥",
        duration: 5000
      });

      return;
    }
    let result = await resp.json();

    for (let student of result.detail.students) {
      student.label = `${student.first_name} ${student.last_name} (${student.username})`;
    }
    if (result.detail.students) {
      console.log("students fetched");
      return result.detail.students;
    }
  }
);

export const saveException = createAsyncThunk("student/saveException", async (exception) => {
  let jsheaders = new Headers({
    "Content-type": "application/json; charset=utf-8",
    Accept: "application/json"
  });
  let data = {
    body: JSON.stringify(exception),
    headers: jsheaders,
    method: "POST"
  };
  let resp = await fetch("/assignment/instructor/save_exception", data);

  if (!resp.ok) {
    console.warn("Error saving exception");
    toast("Error saving exception", {
      icon: "🔥"
    });
    return;
  }
  let result = await resp.json();

  if (result.detail.success) {
    console.log("exception saved");
    toast("Exception saved", { icon: "🎉" });
    return result.detail.success;
  }
});

export const studentSlice = createSlice({
  name: "student",
  initialState: {
    roster: [],
    selectedStudents: []
  },
  reducers: {
    setRoster: (state, action) => {
      state.roster = action.payload;
    },
    setSelectedStudents: (state, action) => {
      state.selectedStudents = action.payload;
    }
  },
  extraReducers(builder) {
    builder
      .addCase(fetchClassRoster.fulfilled, (state, action) => {
        state.roster = action.payload;
      })
      .addCase(fetchClassRoster.rejected, (state, action) => {
        console.warn("Fetching Roster failed", action.error.message);
      });
  }
});

export const { setRoster, setSelectedStudents } = studentSlice.actions;

export const selectRoster = (state) => {
  return state.student.roster;
};
export const selectSelectedStudents = (state) => {
  return state.student.selectedStudents;
};

export default studentSlice.reducer;
