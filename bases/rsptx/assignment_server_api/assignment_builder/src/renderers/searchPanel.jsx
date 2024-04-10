import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputSwitch } from 'primereact/inputswitch';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import Preview from './preview';
import PropTypes from 'prop-types';

import { Accordion, AccordionTab } from 'primereact/accordion';

import {
    addExercise,
    incrementQuestionCount,
    selectExercises,
    selectAssignmentId,
    searchForQuestions,
    selectSearchResults,
    sendExercise,
    setPoints,
    deleteExercises,
    sendDeleteExercises,
} from '../state/assignment/assignSlice';

import { setExerciseDefaults } from '../exUtils';

function PreviewTemplate(exercise) {
    return (
        <Accordion>
            <AccordionTab header="Preview">
                <div className="ptx-runestone-container" style={{"width": "600px"}}>
                    <Preview code={exercise.htmlsrc} />
                </div>
            </AccordionTab>
        </Accordion>
    );
}

PreviewTemplate.propTypes = {
    exercise: PropTypes.object,
};

export function SearchPanel() {
    const dispatch = useDispatch();
    const [selectedQuestionType, setSelectedQuestionType] = useState(null);
    const [searchText, setSearchText] = useState("");
    const [author, setAuthor] = useState("");
    const [baseCourse, setBaseCourse] = useState(true);
    const [selectedQuestions, setSelectedQuestions] = useState([])

    const currentSearchResults = useSelector(selectSearchResults);
    const currentExercises = useSelector(selectExercises);
    const currentAssigmentId = useSelector(selectAssignmentId);

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
    ]
    return (
        <div className="p-fluid">
            <label htmlFor="basecourse">Constrain to base course</label>
            <InputSwitch id="basecourse" checked={baseCourse} onChange={(e) => setBaseCourse(e.value)} />
            <br />
            <label htmlFor="search">Free Text Search for Question</label>
            <InputText id="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="question text"
            />
            <label htmlFor="tags">Search by Tags</label>
            <InputText id="tags"
                placeholder="tags"
            />
            <label htmlFor="type">Search by Question Type</label>
            <Dropdown id="type"
                value={selectedQuestionType}
                placeholder="Select a question type"
                options={qtypes}
                optionLabel="label"
                onChange={(e) => setSelectedQuestionType(e.value)}
            />
            <label htmlFor="author">Search by Author</label>
            <InputText id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Part or all of an author's name"
            />
            <Button label="Search"
                icon="pi pi-search"
                onClick={() => dispatch(searchForQuestions({
                    source_regex: searchText,
                    question_type: selectedQuestionType,
                    author: author,
                    base_course: baseCourse.toLocaleString()
                }))}
            />
            <h3>Search Results</h3>
            <DataTable value={currentSearchResults}
                selectionMode="checkbox"
                metaKeySelection="false"
                dataKey="id"
                selection={selectedQuestions}
                onSelectionChange={(e) => {
                    console.log(selectedQuestions)
                    // if there are more questions then figure out which are new.
                    if (e.value.length > selectedQuestions.length) {
                        let newQuestions = e.value.filter((q) => selectedQuestions.includes(q) === false)
                        console.log(`added ${newQuestions}`)

                        setSelectedQuestions(e.value)
                        let newQuestion = setExerciseDefaults(structuredClone(newQuestions[0]), currentAssigmentId, currentExercises);
                        dispatch(addExercise(newQuestion));
                        dispatch(sendExercise(newQuestion));
                        // dispatching addExercise does not modify the currentExercises array
                        let totalPoints = 0;
                        for (let ex of currentExercises) {
                            totalPoints += ex.points;
                        }
                        if (currentExercises.length > 0) {
                            totalPoints += currentExercises[currentExercises.length - 1].points;
                        }
                        dispatch(incrementQuestionCount());
                        dispatch(setPoints(totalPoints));
                    }
                    // if there are fewer questions then figure out which are gone.
                    if (e.value.length < selectedQuestions.length) {
                        let removedQuestions = selectedQuestions.filter((q) => e.value.includes(q) === false)
                        console.log(`removed ${removedQuestions}`)
                        setSelectedQuestions(e.value)
                        dispatch(deleteExercises(removedQuestions)); // expects array of questions
                        dispatch(sendDeleteExercises(removedQuestions)); // array of ids
                        let totalPoints = 0;
                        removedQuestions = removedQuestions.map((q) => q.id);
                        for (let ex of currentExercises) {
                            if (removedQuestions.includes(ex.id) === false) {
                                totalPoints += ex.points;
                            }
                        }
                        dispatch(setPoints(totalPoints));
                    }
                    setSelectedQuestions(e.value)
                }}
            >
                <Column selectionMode="multiple" style={{ width: '3em' }} />
                <Column field="qnumber" header="Question" sortable />
                <Column field="topic" header="Topic" sortable />
                <Column field="htmlsrc" header="Preview" body={PreviewTemplate} style={{ maxWidth: '100rem' }} />
                <Column field="author" header="Author" />
                <Column field="pct_on_first" header="On First" sortable />
            </DataTable>
        </div>
    );
}

