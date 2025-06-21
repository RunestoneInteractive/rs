/**
 *
 * @file assignmentQuestion.jsx
 * @summary A component to display the questions in the assignment
 * @description This component is a table that displays the questions in the assignment.
 * The table is editable and the user can change the points, autograde, and which_to_grade fields.
 * Questions can be reordered and deleted.
 * This table uses the Handsontable library.
 * @memberof AssignmentEditor
 */
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Panel } from "primereact/panel";
import PropTypes from "prop-types";
import { useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import "handsontable/dist/handsontable.full.min.css";
import { registerAllModules } from "handsontable/registry";
import { HotTable } from "@handsontable/react";

import { renderRunestoneComponent } from "../componentFuncs";
import {
  selectExercises,
  updateExercise,
  sendExercise,
  deleteExercises,
  reorderExercise,
  reorderAssignmentQuestions,
  sendDeleteExercises,
  sumPoints,
  selectId,
} from "../state/assignment/assignSlice";
import { fetchChooserData } from "../state/epicker/ePickerSlice";
import { unSelectNode } from "../state/epicker/ePickerSlice";

// This registers all the plugins for the Handsontable library
registerAllModules();

/**
 * @constant problemColumns
 * @description The columns for the problem table
 * @constant problemColumnSpec
 * @description The column specifications for the problem table
 * @constant readingColumns
 * @description The columns for the reading table
 * @constant readingColumnSpec
 * @description The column specifications for the reading table
 * @memberof AssignmentEditor
 */
export const problemColumns = ["id", "qnumber", "autograde", "which_to_grade", "points"];
export const problemColumnSpec = [
  { type: "numeric", readOnly: true },
  { type: "numeric", readOnly: true },
  {
    type: "dropdown",
    source: [
      "manual",
      "all_or_nothing",
      "pct_correct",
      "peer",
      "peer_chat",
      "interaction",
      "unittest",
    ],
  },
  {
    type: "dropdown",
    source: ["first_answer", "last_answer", "all_answer", "best_answer"],
  },
  { type: "numeric" },
];

// this was experimental, and I got it working but I don't see a reason to use
// it, when you can right click on the row for the same effect.
function renderDelete(instance, td, row, col, prop, value, cellProperties) {
  let butt = document.createElement("button");

  butt.innerHTML = "Delete";
  td.innerHTML = "";
  td.appendChild(butt);
  butt.addEventListener("click", function () {
    console.log("delete row", row);
    instance.alter("remove_row", row);
  });
  //return td;
}

export const readingColumns = ["id", "chapter", "subchapter", "numQuestions", "required", "points"];
export const readingColumnSpec = [
  { type: "numeric", readOnly: true },
  { type: "text", readOnly: true },
  { type: "text", readOnly: true },
  { type: "numeric", readOnly: true },
  { type: "numeric" },
  { type: "numeric" },
];

/**
 * @function AssignmentQuestion
 * @summary The AssignmentQuestion component
 * @description This component is a table that displays the questions in the assignment.
 * The table is editable and the user can change the points, autograde, and which_to_grade fields.
 * Questions can be reordered and deleted.
 * This table uses the Handsontable library.
 * @returns The AssignmentQuestion component
 * @memberof AssignmentEditor
 */
export function AssignmentQuestion(props) {
  const dispatch = useDispatch();
  const question_rows = useSelector(selectExercises);

  console.log("columns", props.columns);
  let ref = useRef(null);

  // if (props.columns.indexOf("autograde") > -1 &&
  //     props.columns.indexOf("preview") == -1 ) {
  //     props.columns.push("preview");
  //     props.columnSpecs.push({ renderer: renderPreview });
  // }

  function renderPreview(instance, td, row, col, prop, value, cellProperties) {
    let butt = document.createElement("button");

    butt.innerHTML = "Preview";
    td.innerHTML = "";
    td.appendChild(butt);
    butt.addEventListener("click", function () {
      console.log("preview row", row);
      ref.current.innerHTML = question_rows[row].htmlsrc;
      renderRunestoneComponent(ref, {});
    });
  }

  let hotData = [];

  for (let row of question_rows) {
    let newRow = [];

    for (let col of props.columns) {
      newRow.push(row[col]);
    }
    if (props.isReading && row.reading_assignment) {
      hotData.push(newRow);
    } else if (!props.isReading && !row.reading_assignment) {
      hotData.push(newRow);
    }
  }

  const findRowById = (id) => {
    for (let row of question_rows) {
      if (row.id === id) {
        return row;
      }
    }
    return null;
  };
  const handleChange = (change, source) => {
    if (source === "loadData" || source === "updateData") {
      return;
    }
    console.log(change); // gives us [row, column, oldVal, newVal]
    console.log(hotData);
    let changeKey = props.columns[change[0][1]];

    for (let c of change) {
      let row = c[0];
      let col = c[1];
      let oldVal = c[2];
      let newVal = c[3];
      let id = hotData[row][0];
      let key = props.columns[col];
      let new_row = structuredClone(findRowById(id));

      new_row[key] = newVal;
      if (newVal !== oldVal) {
        dispatch(updateExercise({ id: id, exercise: new_row }));
        dispatch(sendExercise(new_row));
      }
    }
    if (changeKey === "points") {
      dispatch(sumPoints());
    }
  };

  const handleDelete = (start, amount) => {
    // Called by the afterRemoveRow hook in HotTable
    // by the time this is called hotData is already updated and the row is gone.
    console.log("delete row", start, amount);
    for (let row of hotData) {
      console.log(row);
    }
    let toRemove = question_rows.slice(start, start + amount);
    let namesToRemove = question_rows.slice(start, start + amount).map((ex) => ex.name);

    try {
      dispatch(deleteExercises(toRemove));
      dispatch(sendDeleteExercises(toRemove));
      dispatch(sumPoints());
      dispatch(fetchChooserData({ skipreading: false, from_source_only: false, pages_only: false }));
      dispatch(unSelectNode(namesToRemove));
    } catch (e) {
      console.error(e);
    }
  };

  const handleReorder = (rows, target) => {
    console.log("reorder", rows, target);
    // copy hotData to avoid mutating the state
    let idxs = hotData.map((r) => r[0]);
    let toMove = idxs.splice(rows[0], rows.length);

    if (target > rows[0]) {
      target -= rows.length;
    }
    idxs.splice(target, 0, ...toMove);
    dispatch(reorderExercise({ exOrder: idxs }));
    dispatch(reorderAssignmentQuestions(idxs));
  };
  const aqStyle = {
    marginBottom: "10px",
  };

  const readingHelpText = (
    <p className="m-0">
      Reading assignments are meant to encourage students to do the reading, by giving them points
      for interacting with various interactive elements that are a part of the page. The number of
      activities required is set to 80% of the number of questions in the reading. Readings
      assignments are meant to be <strong>formative</strong> and therefore the questions are not
      graded for correctness, rather the students are given points for interacting with them.
    </p>
  );

  const problemHelpText = (
    <>
      <p className="m-0">
        Graded questions are meant to be <strong>summative</strong> and therefore the questions are
        graded for correctness. The correctness of a question is recorded at the time the student
        answers the question. The autograde field determines how the questions are scored, for
        example &ldquo;all or nothing&rdquo; or &ldquo;percent correct&rdquo;. The which_to_grade
        field determines which answer to grade, for example the first answer or the last answer.
        normally this is set to &ldquo;best answer&rdquo;. This allows you to change the way and
        assignment is scored even after the students have answered the questions.
      </p>
      <p>
        The table below can be thought of like a spreadsheet. You can reorder the questions by
        dragging the rows. You can delete a question by right clicking in the margin. You can copy
        and paste values across multple rows within a column to change the default values for
        points, autograde or which to grade.
      </p>
    </>
  );

  return (
    <div className="App">
      <Panel
        headerTemplate={qpHeader}
        header={props.headerTitle}
        helptext={props.isReading ? readingHelpText : problemHelpText}
        toggleable
      >
        <HotTable
          style={aqStyle}
          width="100%"
          data={hotData}
          stretchH="all"
          colHeaders={props.columns}
          rowHeaders={true}
          manualRowMove={true}
          contextMenu={true}
          allowRemoveRow={true}
          hiddenColumns={{ columns: [0] }}
          columns={props.columnSpecs}
          afterChange={handleChange}
          afterRowMove={handleReorder}
          afterRemoveRow={handleDelete}
          licenseKey="non-commercial-and-evaluation"
        />
      </Panel>
      <div ref={ref} />
    </div>
  );
}

/**
 *
 * @param {*} options
 * @function qpHeader
 * @returns A header for the reading panel.  This header contains a help icon that displays a dialog when clicked.
 * @memberof AssignmentEditor
 * @note options is an object that contains a props object that is passed through from the Panel
 */
const qpHeader = (options) => {
  const className = `${options.className} justify-content-space-between`;
  const [visible, setVisible] = useState(false);
  const currentId = useSelector(selectId);
  const assignHref = `/assignment/student/doAssignment?assignment_id=${currentId}`;
  var previewButton = null;

  if (options.props.header === "Graded Exercises") {
    previewButton = (
      <Button
        label="Preview"
        icon="pi pi-link"
        severity="secondary"
        text
        outlined
        onClick={() => window.open(assignHref)}
      />
    );
  }

  return (
    <>
      <div className={className}>
        <div className="flex align-items-center gap-2">
          <span className="p-panel-title">{options.props.header} </span>
          <button className="p-panel-header-icon p-link mr-2">
            <span>
              <i className="pi pi-info-circle" onClick={() => setVisible(true)}></i>
            </span>
          </button>
          {previewButton}
        </div>
        <div>{options.togglerElement}</div>
      </div>
      <Dialog
        header={options.props.header}
        visible={visible}
        style={{ width: "50vw" }}
        onHide={() => setVisible(false)}
      >
        {options.props.helptext}
      </Dialog>
    </>
  );
};

AssignmentQuestion.propTypes = {
  headerTitle: PropTypes.string,
  columns: PropTypes.array,
  columnSpecs: PropTypes.array,
  isReading: PropTypes.bool,
};
