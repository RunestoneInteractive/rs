import {
  Accordion,
  ActionIcon,
  Button,
  Checkbox,
  Popover,
  Select,
  Switch,
  Table,
  TextInput
} from "@mantine/core";
import { IconPencil, IconSearch } from "@tabler/icons-react";
import PropTypes from "prop-types";
import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { notify } from "@components/ui/notify";

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
  sumPoints
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
      <Accordion.Item value="preview">
        <Accordion.Control>Preview</Accordion.Control>
        <Accordion.Panel>
          <div className="ptx-runestone-container" style={{ width: "600px" }}>
            <Preview code={exercise.htmlsrc} exercise={exercise} />
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

PreviewTemplate.propTypes = {
  exercise: PropTypes.object
};

/**
 * @function SearchPanel
 * @summary The SearchPanel component
 * @description This component is a panel that allows the user to search for questions and add them to the assignment.
 * The user can search by question text, tags, question type, and author.
 * The user can also constrain the search to the base course.
 * The search results are displayed in a table.
 * The user can select questions from the table to add to the assignment, or preview the question.
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
    { label: "Doenet", value: "doenet" }
  ];

  return (
    <div className="p-fluid">
      <label htmlFor="basecourse">Constrain to base course</label>
      <Switch
        id="basecourse"
        checked={baseCourse}
        onChange={(e) => setBaseCourse(e.currentTarget.checked)}
      />
      <br />
      <label htmlFor="search">Free Text Search for Question</label>
      <TextInput
        id="search"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="question text"
      />
      <label htmlFor="tags">Search by Tags</label>
      <TextInput id="tags" placeholder="tags" />
      <label htmlFor="type">Search by Question Type</label>
      <Select
        id="type"
        value={selectedQuestionType}
        placeholder="Select a question type"
        data={qtypes}
        onChange={(value) => setSelectedQuestionType(value)}
      />
      <label htmlFor="author">Search by Author</label>
      <TextInput
        id="author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Part or all of an author's name"
      />
      <Button
        leftSection={<IconSearch size={16} />}
        onClick={() =>
          dispatch(
            searchForQuestions({
              source_regex: searchText,
              question_type: selectedQuestionType,
              author: author,
              base_course: baseCourse.toLocaleString()
            })
          )
        }
      >
        Search
      </Button>
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

  const toggleQuestion = (question, checked) => {
    if (checked) {
      setSelectedQuestions([...selectedQuestions, question]);
      const newQuestion = setExerciseDefaults(
        structuredClone(question),
        currentAssigmentId,
        currentExercises
      );

      dispatch(addExercise(newQuestion));
      dispatch(sendExercise(newQuestion));
      dispatch(sumPoints());
    } else {
      setSelectedQuestions(selectedQuestions.filter((q) => q !== question));
      dispatch(deleteExercises([question]));
      dispatch(sendDeleteExercises([question]));
      dispatch(sumPoints());
    }
  };

  return (
    <>
      <h3>Search Results</h3>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: "3em" }} />
            <Table.Th>Edit</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Question</Table.Th>
            <Table.Th>Topic</Table.Th>
            <Table.Th>Preview</Table.Th>
            <Table.Th>Author</Table.Th>
            <Table.Th>On First</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(currentSearchResults || []).map((question) => (
            <Table.Tr key={question.id}>
              <Table.Td>
                <Checkbox
                  checked={selectedQuestions.includes(question)}
                  onChange={(e) => toggleQuestion(question, e.currentTarget.checked)}
                  aria-label={`Select ${question.name}`}
                />
              </Table.Td>
              <Table.Td>
                <EditButton {...question} />
              </Table.Td>
              <Table.Td>{question.name}</Table.Td>
              <Table.Td>{question.qnumber}</Table.Td>
              <Table.Td>{question.topic}</Table.Td>
              <Table.Td style={{ maxWidth: "100rem" }}>{PreviewTemplate(question)}</Table.Td>
              <Table.Td>{question.author}</Table.Td>
              <Table.Td>{question.pct_on_first}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}

export function EditButton(exercise) {
  const [opened, setOpened] = useState(false);
  const dispatch = useDispatch();

  const toggleEditor = () => {
    if (!exercise.question_json) {
      notify.error("Select a question to edit first.");
      return;
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
    setOpened((current) => !current);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" withArrow trapFocus>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="xl"
          type="button"
          onClick={toggleEditor}
          aria-label="Edit"
        >
          <IconPencil size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <EditorContainer exercise={exercise.question_type} editonly={true} />
      </Popover.Dropdown>
    </Popover>
  );
}
