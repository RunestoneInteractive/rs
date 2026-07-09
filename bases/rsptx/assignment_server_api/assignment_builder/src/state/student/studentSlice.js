import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { notify } from "@components/ui/notify";

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
      notify.error("Couldn't load students. Try again.");

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
    notify.error("Couldn't save the exception. Try again.");
    return;
  }
  let result = await resp.json();

  if (result.detail.success) {
    console.log("exception saved");
    notify.success("Exception saved");
    return result.detail.success;
  }
});

export const fetchAccommodations = createAsyncThunk("student/fetchAccommodations", async () => {
  let jsheaders = new Headers({
    "Content-type": "application/json; charset=utf-8",
    Accept: "application/json"
  });
  let data = {
    headers: jsheaders,
    method: "GET"
  };
  let resp = await fetch("/assignment/instructor/accommodations", data);

  if (!resp.ok) {
    console.warn("Error fetching accommodations");
    notify.error("Couldn't load accommodations. Try again.");
    return [];
  }
  let result = await resp.json();

  if (result.detail.accommodations) {
    console.log("accommodations fetched");
    return result.detail.accommodations;
  }
  return [];
});

export const deleteAccommodations = createAsyncThunk(
  "student/deleteAccommodations",
  async (idList) => {
    let jsheaders = new Headers({
      "Content-type": "application/json; charset=utf-8",
      Accept: "application/json"
    });
    let data = {
      headers: jsheaders,
      method: "DELETE"
    };
    for (let id of idList) {
      let resp = await fetch(`/assignment/instructor/accommodation/${id}`, data);

      if (!resp.ok) {
        console.warn("Error deleting accommodation id ", id);
        notify.error(`Couldn't delete accommodation ${id}. Try again.`);
      }
    }

    return idList;
  }
);

export const studentSlice = createSlice({
  name: "student",
  initialState: {
    roster: [],
    selectedStudents: [],
    accommodations: []
  },
  reducers: {
    setRoster: (state, action) => {
      state.roster = action.payload;
    },
    setSelectedStudents: (state, action) => {
      state.selectedStudents = action.payload;
    },
    setAccommodations: (state, action) => {
      state.accommodations = action.payload;
    }
  },
  extraReducers(builder) {
    builder
      .addCase(fetchClassRoster.fulfilled, (state, action) => {
        state.roster = action.payload;
      })
      .addCase(fetchClassRoster.rejected, (state, action) => {
        console.warn("Fetching Roster failed", action.error.message);
      })
      .addCase(fetchAccommodations.fulfilled, (state, action) => {
        state.accommodations = action.payload;
      })
      .addCase(fetchAccommodations.rejected, (state, action) => {
        console.warn("Fetching Accommodations failed", action.error.message);
      });
  }
});

export const { setRoster, setSelectedStudents, setAccommodations } = studentSlice.actions;

export const selectRoster = (state) => {
  return state.student.roster;
};
export const selectSelectedStudents = (state) => {
  return state.student.selectedStudents;
};
export const selectAccommodations = (state) => {
  return state.student.accommodations;
};

export default studentSlice.reducer;
