import { Dropdown } from "primereact/dropdown";
import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { allChapters } from "../state/epicker/ePickerSlice";
import { setChapter, selectChapter } from "../state/interactive/interactiveSlice";

export function ChapterSelector() {
  // const chapterOptions = chapters.map((node) => {
  //     return { chapter: node.key, title: node.data.title };
  // });
  const chapterOptions = useSelector(allChapters);
  const dispatch = useDispatch();
  const currentChapter = useSelector(selectChapter);
  const sChapter = chapterOptions.find((node) => node.chapter === currentChapter);
  const [selectedChapter, setSelectedChapter] = useState(sChapter);

  return (
    <Dropdown
      options={chapterOptions}
      value={selectedChapter}
      optionLabel="title"
      onChange={(e) => {
        dispatch(setChapter(e.value.chapter));
        setSelectedChapter(e.value);
      }}
      placeholder="Select a chapter"
    />
  );
}
