import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { OverlayPanel } from "primereact/overlaypanel";
import PropTypes from "prop-types";
import React, { useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";

import { setExerciseDefaults } from "../exUtils";
import { setACFields } from "../state/activecode/acSlice";
import {
  addExercise,
  selectExercises,
  selectAssignmentId,
  searchForQuestions,
  selectSearchResults,
  sendExercise,
  deleteExercises,
  sendDeleteExercises,
  sumPoints,
} from "../state/assignment/assignSlice";
import { setComponent } from "../state/componentEditor/editorSlice";
import { setQuestion, setPreviewSrc } from "../state/interactive/interactiveSlice";
import { setMCFields } from "../state/multiplechoice/mcSlice";

import { EditorContainer } from "./editorModeChooser";
import Preview from "./preview";

/**
 * @description This component creates and accordian and preview of an exercise designed to live inside a DataTable.
 * @param {string} exercise
 * @returns An accordian component with a preview of the exercise
 * @memberof AssignmentEditor
 */
export function PreviewTemplate(exercise) {
  if (exercise.children) {
    return null;
  } else if (exercise.data) {
    console.log(exercise.data);
    exercise = exercise.data;
  }
  return (
    <Accordion>
      <AccordionTab header="Preview">
        <div className="ptx-runestone-container" style={{ width: "600px" }}>
          <Preview code={exercise.htmlsrc} exercise={exercise} />
        </div>
      </AccordionTab>
    </Accordion>
  );
}

PreviewTemplate.propTypes = {
  exercise: PropTypes.object,
};

/**
 * @function SearchPanel
 * @summary The SearchPanel component
 * @description This component is a panel that allows the user to search for questions and add them to the assignment.
 * The user can search by question text, tags, question type, and author.
 * The user can also constrain the search to the base course.
 * The search results are displayed in a table.
 * The user can select questions from the table to add to the assignment, or preview the question.
 * This panel uses the PrimeReact library.
 *
 * @returns The SearchPanel component
 * @memberof AssignmentEditor
 */
export function SearchPanel() {
  const dispatch = useDispatch();
  const [selectedQuestionType, setSelectedQuestionType] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [author, setAuthor] = useState("");
  const [baseCourse, setBaseCourse] = useState(true);

  const qtypes = [
    { label: "All", value: "" },
    { label: "Multiple Choice", value: "mchoice" },
    { label: "Short Answer", value: "shortanswer" },
    { label: "Active Code", value: "activecode" },
    { label: "Fill in the Blank", value: "fillintheblank" },
    { label: "Clickable Area", value: "clickablearea" },
    { label: "Poll", value: "poll" },
    { label: "Drag and Drop", value: "draganddrop" },
    { label: "Parsons Problem", value: "parsonsprob" },
    { label: "Horizontal Parsons", value: "hparsons" },
    { label: "WeBWorK", value: "webwork" },
    { label: "Doenet", value: "doenet" },
  ];

  return (
    <div className="p-fluid">
      <label htmlFor="basecourse">Constrain to base course</label>
      <InputSwitch id="basecourse" checked={baseCourse} onChange={(e) => setBaseCourse(e.value)} />
      <br />
      <label htmlFor="search">Free Text Search for Question</label>
      <InputText
        id="search"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="question text"
      />
      <label htmlFor="tags">Search by Tags</label>
      <InputText id="tags" placeholder="tags" />
      <label htmlFor="type">Search by Question Type</label>
      <Dropdown
        id="type"
        value={selectedQuestionType}
        placeholder="Select a question type"
        options={qtypes}
        optionLabel="label"
        onChange={(e) => setSelectedQuestionType(e.value)}
      />
      <label htmlFor="author">Search by Author</label>
      <InputText
        id="author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Part or all of an author's name"
      />
      <Button
        label="Search"
        icon="pi pi-search"
        onClick={() =>
          dispatch(
            searchForQuestions({
              source_regex: searchText,
              question_type: selectedQuestionType,
              author: author,
              base_course: baseCourse.toLocaleString(),
            }),
          )
        }
      />
      <SearchResults />
    </div>
  );
}

export function SearchResults() {
  const dispatch = useDispatch();
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const currentSearchResults = useSelector(selectSearchResults);
  const currentExercises = useSelector(selectExercises);
  const currentAssigmentId = useSelector(selectAssignmentId);

  return (
    <>
      <h3>Search Results</h3>
      <DataTable
        value={currentSearchResults}
        selectionMode="checkbox"
        metaKeySelection="false"
        dataKey="id"
        selection={selectedQuestions}
        onSelectionChange={(e) => {
          // if there are more questions then figure out which are new.
          if (e.value.length > selectedQuestions.length) {
            let newQuestions = e.value.filter((q) => selectedQuestions.includes(q) === false);

            console.log(`added ${newQuestions}`);

            setSelectedQuestions(e.value);
            let newQuestion = setExerciseDefaults(
              structuredClone(newQuestions[0]),
              currentAssigmentId,
              currentExercises,
            );

            dispatch(addExercise(newQuestion));
            dispatch(sendExercise(newQuestion));
            // dispatching addExercise does not modify the currentExercises array
            dispatch(sumPoints());
          }
          // if there are fewer questions then figure out which are gone.
          if (e.value.length < selectedQuestions.length) {
            let removedQuestions = selectedQuestions.filter((q) => e.value.includes(q) === false);

            console.log(`removed ${removedQuestions}`);
            setSelectedQuestions(e.value);
            dispatch(deleteExercises(removedQuestions)); // expects array of questions
            dispatch(sendDeleteExercises(removedQuestions)); // array of ids
            dispatch(sumPoints());
          }
          setSelectedQuestions(e.value);
        }}
      >
        <Column selectionMode="multiple" style={{ width: "3em" }} />
        <Column field="question_json" header="Edit" body={EditButton} />
        <Column field="name" header="Name" sortable />
        <Column field="qnumber" header="Question" sortable />
        <Column field="topic" header="Topic" sortable />
        <Column
          field="htmlsrc"
          header="Preview"
          body={PreviewTemplate}
          style={{ maxWidth: "100rem" }}
        />
        <Column field="author" header="Author" />
        <Column field="pct_on_first" header="On First" sortable />
      </DataTable>
    </>
  );
}

export function EditButton(exercise) {
  const op = useRef(null);
  const dispatch = useDispatch();

  const toggleEditor = (e) => {
    if (!exercise.question_json) {
      toast("No question to edit", { icon: "🚫" });
      return null;
    }
    dispatch(setQuestion(exercise));
    dispatch(setComponent(exercise.question_type));
    dispatch(setPreviewSrc(exercise.htmlsrc));
    if (exercise.question_type === "activecode") {
      dispatch(setACFields(exercise.question_json));
    } else if (
      exercise.question_type === "mchoice" ||
      exercise.question_type === "multiplechoice"
    ) {
      dispatch(setMCFields(exercise.question_json));
    }
    op.current.toggle(e);
  };

  return (
    <>
      <Button
        icon="pi pi-pencil"
        rounded
        text
        type="button"
        severity="secondary"
        onClick={toggleEditor}
      />
      <OverlayPanel ref={op} dismissable={false} showCloseIcon>
        <EditorContainer exercise={exercise.question_type} editonly={true} />
      </OverlayPanel>
    </>
  );
}
