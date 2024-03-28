import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

export const fetchChooserData = createAsyncThunk(
    "ePicker/fetchChooserData",
    // incoming is an object that has keys for skipreading, from_source_only, and pages_only
    // and a value that is a boolean  This can be used for search results for reading questions
    // or for problem sets.
    async (incoming) => {
        let jsheaders = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
        });
        let data = {
            body: JSON.stringify(incoming),
            headers: jsheaders,
            method: "POST",
        };
        let resp = await fetch("/assignment/instructor/fetch_chooser_data", data);
        if (!resp.ok) {
            console.warn("Error fetching picker content");
            if (resp.status === 422) {
                console.warn("Missing data for getting picker content");
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
                toast(
                    `Error ${result.detail[0].msg} for input ${result.detail[0].loc}`,
                    { duration: 5000 }
                );
            } else {
                toast("Error fetching questions", {
                    icon: "🔥",
                    duration: 5000,
                });
            }

            return;
        }
        let result = await resp.json();
        if (result.detail.questions) {
            console.log("data fetched");
            return result.detail;
        }
    }
);

// create a slice for ActiveCodeEditor
// This slice must be registered with the store in store.js
export const epSlice = createSlice({
    name: "ePicker",
    initialState: {
        nodes: [],
    },
    reducers: {
        // todo -- this should have a keys for chapter and subchapter to insert the new node
        addExercise: (state, action) => {
            state.nodes.push(action.payload.newNode);
        },
        setNodes: (state, action) => {
            state.nodes = action.payload.questions;
        }
    },
    extraReducers(builder) {
        builder
            .addCase(fetchChooserData.fulfilled, (state, action) => {
                console.log("Question saved");
                state.nodes = action.payload.questions;
            })
            .addCase(fetchChooserData.rejected, (state, action) => {
                console.log("Fetching Questions failed");
            });
    },
});

export const { addExercise } = epSlice.actions;


// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const chooserNodes = (state) => {
    return state.ePicker.nodes;
}

export default epSlice.reducer;
