import { Editor, Extension, Range } from "@tiptap/core";

export type InsertFormKind = "codeBlock" | "math" | "link" | "imageUrl" | "youtube";

export interface InsertFormRequest {
  kind: InsertFormKind;
  position: { x: number; y: number };
}

export type InsertFormOpener = (request: InsertFormRequest) => void;

interface InsertFormBridgeStorage {
  open: InsertFormOpener | null;
}

export const InsertFormBridge = Extension.create<Record<string, never>, InsertFormBridgeStorage>({
  name: "insertFormBridge",

  addStorage() {
    return {
      open: null
    };
  }
});

export const openInsertForm = (editor: Editor, kind: InsertFormKind, range: Range): boolean => {
  const storage = editor.storage.insertFormBridge as InsertFormBridgeStorage | undefined;

  if (!storage?.open) {
    return false;
  }

  editor.chain().focus().deleteRange(range).run();

  const coords = editor.view.coordsAtPos(editor.state.selection.from);

  storage.open({ kind, position: { x: coords.left, y: coords.bottom + 4 } });
  return true;
};
