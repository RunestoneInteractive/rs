import {
  InsertFormKind,
  InsertFormRequest
} from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/extensions/InsertFormBridge";
import { Button, Group, TextInput } from "@mantine/core";
import { Editor } from "@tiptap/core";
import { FC, FormEvent, useEffect, useRef, useState } from "react";

import styles from "./InsertFormPopover.module.css";

export const INSERT_FORM_COPY: Record<
  InsertFormKind,
  { formLabel: string; label: string; placeholder: string }
> = {
  codeBlock: {
    formLabel: "Insert code block",
    label: "Language (optional)",
    placeholder: "python"
  },
  math: { formLabel: "Insert math", label: "LaTeX formula", placeholder: "\\frac{1}{2}" },
  link: { formLabel: "Insert link", label: "Link URL", placeholder: "https://…" },
  imageUrl: { formLabel: "Insert image", label: "Image URL", placeholder: "https://…" },
  youtube: { formLabel: "Insert YouTube video", label: "YouTube URL", placeholder: "https://…" }
};

export const INSERT_FORM_ERRORS = {
  url: "Enter a valid URL (https://…)",
  math: "Enter a LaTeX formula"
};

const URL_PATTERN = /^https?:\/\/\S+$/i;
const FORM_WIDTH = 280;

export const validateInsertFormValue = (kind: InsertFormKind, value: string): string | null => {
  const trimmed = value.trim();

  if (kind === "codeBlock") {
    return null;
  }
  if (kind === "math") {
    return trimmed ? null : INSERT_FORM_ERRORS.math;
  }
  return URL_PATTERN.test(trimmed) ? null : INSERT_FORM_ERRORS.url;
};

export const applyInsertForm = (editor: Editor, kind: InsertFormKind, value: string): void => {
  const trimmed = value.trim();
  const chain = editor.chain().focus();

  switch (kind) {
    case "codeBlock":
      (trimmed ? chain.setCodeBlock({ language: trimmed }) : chain.setCodeBlock()).run();
      return;
    case "math":
      chain.insertContent({ type: "inlineMath", attrs: { latex: trimmed } }).run();
      return;
    case "link":
      chain.setLink({ href: trimmed }).run();
      return;
    case "imageUrl":
      chain.setImage({ src: trimmed }).run();
      return;
    case "youtube":
      chain.setYoutubeVideo({ src: trimmed }).run();
  }
};

export const useInsertForm = (editor: Editor | null) => {
  const [insertFormRequest, setInsertFormRequest] = useState<InsertFormRequest | null>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.storage.insertFormBridge.open = setInsertFormRequest;
    return () => {
      editor.storage.insertFormBridge.open = null;
    };
  }, [editor]);

  return { insertFormRequest, closeInsertForm: () => setInsertFormRequest(null) };
};

interface InsertFormPopoverProps {
  editor: Editor;
  request: InsertFormRequest | null;
  onClose: () => void;
}

export const InsertFormPopover: FC<InsertFormPopoverProps> = ({ editor, request, onClose }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    setError(null);
    inputRef.current?.focus();
  }, [request]);

  useEffect(() => {
    if (!request) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        !(event.target instanceof Node) ||
        !inputRef.current?.closest("form")?.contains(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onClose();
      editor.commands.focus();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [editor, onClose, request]);

  if (!request) {
    return null;
  }

  const copy = INSERT_FORM_COPY[request.kind];

  const cancel = () => {
    onClose();
    editor.commands.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateInsertFormValue(request.kind, value);

    if (validationError) {
      setError(validationError);
      return;
    }
    onClose();
    applyInsertForm(editor, request.kind, value);
  };

  const left = Math.max(8, Math.min(request.position.x, window.innerWidth - FORM_WIDTH - 8));

  return (
    <form
      className={styles.insertForm}
      style={{ left, top: request.position.y }}
      role="dialog"
      aria-label={copy.formLabel}
      onSubmit={handleSubmit}
    >
      <TextInput
        ref={inputRef}
        label={copy.label}
        placeholder={copy.placeholder}
        value={value}
        error={error}
        size="xs"
        onChange={(event) => {
          setValue(event.currentTarget.value);
          setError(null);
        }}
      />
      <Group justify="flex-end" gap="xs" mt="xs">
        <Button variant="default" size="xs" onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" size="xs">
          Insert
        </Button>
      </Group>
    </form>
  );
};
