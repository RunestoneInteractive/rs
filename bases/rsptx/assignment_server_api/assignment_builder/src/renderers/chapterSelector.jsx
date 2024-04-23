import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Dropdown } from "primereact/dropdown"; 
import { allChapters } from "../state/epicker/ePickerSlice";
import { setChapter } from "../state/activecode/acSlice";

export function ChapterSelector() {
    // const chapterOptions = chapters.map((node) => {
    //     return { chapter: node.key, title: node.data.title };
    // });
    const chapterOptions = useSelector(allChapters)
    const dispatch = useDispatch();
    const [selectedChapter, setSelectedChapter] = useState(null);

    return (
        <Dropdown
            options={chapterOptions}
            value={selectedChapter}
            optionLabel="title"
            onChange={(e) => {
                dispatch(setChapter(e.value.chapter))
                setSelectedChapter(e.value);
            }}
            placeholder="Select a chapter"
        />
    );
}

