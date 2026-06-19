import { Select } from "@mantine/core";
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
    <Select
      data={chapterOptions.map((node) => ({ value: node.chapter, label: node.title }))}
      value={selectedChapter ? selectedChapter.chapter : null}
      onChange={(value) => {
        dispatch(setChapter(value));
        setSelectedChapter(chapterOptions.find((node) => node.chapter === value) || null);
      }}
      placeholder="Select a chapter"
    />
  );
}
