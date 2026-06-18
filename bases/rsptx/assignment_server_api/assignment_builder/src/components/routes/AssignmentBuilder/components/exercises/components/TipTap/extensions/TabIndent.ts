import { Editor, Extension } from "@tiptap/core";

export type TabIndentEditor = Pick<Editor, "isActive"> & {
  commands: Pick<Editor["commands"], "insertContent" | "sinkListItem" | "liftListItem">;
};

export const handleTab = (editor: TabIndentEditor): boolean => {
  if (editor.isActive("codeBlock")) {
    return editor.commands.insertContent("\t");
  }
  if (editor.isActive("listItem")) {
    return editor.commands.sinkListItem("listItem");
  }
  return false;
};

export const handleShiftTab = (editor: TabIndentEditor): boolean => {
  if (editor.isActive("listItem")) {
    return editor.commands.liftListItem("listItem");
  }
  return false;
};

export const TabIndent = Extension.create({
  name: "tabIndent",

  addKeyboardShortcuts() {
    return {
      Tab: () => handleTab(this.editor),
      "Shift-Tab": () => handleShiftTab(this.editor)
    };
  }
});
