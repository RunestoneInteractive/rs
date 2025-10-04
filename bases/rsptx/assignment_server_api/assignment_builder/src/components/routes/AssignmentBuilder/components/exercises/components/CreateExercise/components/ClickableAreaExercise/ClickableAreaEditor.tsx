import { MathExtension } from "@aarkue/tiptap-math-extension";
import { TipTapImage } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Plugins/Image";
import { katexMacros } from "@components/routes/AssignmentBuilder/mathMacros";
import { Extension } from "@tiptap/core";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "primereact/button";
import { useEffect, useCallback } from "react";

import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "tippy.js/dist/tippy.css";
import "katex/dist/katex.min.css";

import styles from "../../../TipTap/Editor.module.css";
import { Command, items } from "../../../TipTap/SlashCommands";
import { TipTapDocModal, useTipTapDocModal } from "../../../TipTap/TipTapDocModal";

import { CustomCodeBlock } from "./CustomCodeBlock";
import { ClickableArea } from "./types";

const customStyles = `
  .tippy-box {
    border: none !important;
    background: none !important;
    box-shadow: none !important;
  }
  .tippy-content {
    padding: 0 !important;
  }
  .tipty-arrow {
    display: none !important;
  }
  .katex { font-size: 1.1em; }
  
  /* TipTap Highlight extension custom styles for clickable areas */
  mark[data-color="clickable-correct"],
  .ProseMirror mark[data-color="clickable-correct"] {
    background-color: rgba(34, 197, 94, 0.3) !important;
    color: inherit !important;
    padding: 2px 4px !important;
    border-radius: 3px !important;
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
  }
  
  mark[data-color="clickable-incorrect"],
  .ProseMirror mark[data-color="clickable-incorrect"] {
    background-color: rgba(239, 68, 68, 0.3) !important;
    color: inherit !important;
    padding: 2px 4px !important;
    border-radius: 3px !important;
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
  }
  
  /* Enhanced specificity for code blocks */
  pre.line-numbers code[class*="language-"] mark[data-color="clickable-correct"],
  pre code[class*="language-"] mark[data-color="clickable-correct"],
  .ProseMirror pre.line-numbers code[class*="language-"] mark[data-color="clickable-correct"],
  .ProseMirror pre code[class*="language-"] mark[data-color="clickable-correct"] {
    background-color: rgba(34, 197, 94, 0.6) !important;
    color: inherit !important;
    padding: 1px 3px !important;
    border-radius: 2px !important;
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    position: relative !important;
    z-index: 1 !important;
  }
  
  pre.line-numbers code[class*="language-"] mark[data-color="clickable-incorrect"],
  pre code[class*="language-"] mark[data-color="clickable-incorrect"],
  .ProseMirror pre.line-numbers code[class*="language-"] mark[data-color="clickable-incorrect"],
  .ProseMirror pre code[class*="language-"] mark[data-color="clickable-incorrect"] {
    background-color: rgba(239, 68, 68, 0.6) !important;
    color: inherit !important;
    padding: 1px 3px !important;
    border-radius: 2px !important;
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    position: relative !important;
    z-index: 1 !important;
  }
  
  /* Fallback for any pre/code elements */
  pre mark[data-color="clickable-correct"],
  code mark[data-color="clickable-correct"] {
    background-color: rgba(34, 197, 94, 0.5) !important;
    color: inherit !important;
    padding: 1px 3px !important;
    border-radius: 2px !important;
    font-family: inherit !important;
  }
  
  pre mark[data-color="clickable-incorrect"],
  code mark[data-color="clickable-incorrect"] {
    background-color: rgba(239, 68, 68, 0.5) !important;
    color: inherit !important;
    padding: 1px 3px !important;
    border-radius: 2px !important;
    font-family: inherit !important;
  }
  
  /* Global mark styling */
  mark[data-color^="clickable-"] {
    position: relative !important;
    display: inline !important;
    line-height: inherit !important;
    vertical-align: baseline !important;
  }
  
  /* Module CSS compatibility */
  [class*="Editor_editor"] mark[data-color="clickable-correct"] {
    background-color: rgba(34, 197, 94, 0.3) !important;
  }
  
  [class*="Editor_editor"] mark[data-color="clickable-incorrect"] {
    background-color: rgba(239, 68, 68, 0.3) !important;
  }
  
  [class*="Editor_editor"] pre mark[data-color="clickable-correct"],
  [class*="Editor_editor"] code mark[data-color="clickable-correct"] {
    background-color: rgba(34, 197, 94, 0.5) !important;
  }
  
  [class*="Editor_editor"] pre mark[data-color="clickable-incorrect"],
  [class*="Editor_editor"] code mark[data-color="clickable-incorrect"] {
    background-color: rgba(239, 68, 68, 0.5) !important;
  }
`;

const TabExtension = Extension.create({
  name: "tab",
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        return this.editor.commands.insertContent("\t");
      }
    };
  }
});

interface ClickableAreaEditorProps {
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  clickableAreas: ClickableArea[];
  onAddClickableArea: (
    text: string,
    isCorrect: boolean,
    startOffset: number,
    endOffset: number
  ) => void;
  onUpdateClickableAreas: (areas: ClickableArea[]) => void;
}

export const ClickableAreaEditor = ({
  content,
  onChange,
  onFocus,
  clickableAreas,
  onAddClickableArea,
  onUpdateClickableAreas
}: ClickableAreaEditorProps) => {
  const { visible, showModal, hideModal } = useTipTapDocModal();

  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        bulletList: {
          HTMLAttributes: {
            class: "list-disc list-outside ml-4"
          }
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal list-outside ml-4"
          }
        },
        listItem: {
          HTMLAttributes: {
            class: "leading-normal"
          }
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-stone-700"
          }
        },
        hardBreak: {
          keepMarks: false
        }
      }),
      CustomCodeBlock,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      FontFamily.configure({
        types: ["textStyle"]
      }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: "clickable-area-highlight"
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          class: "link"
        }
      }),
      TipTapImage.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "editor-image"
        }
      }),
      Youtube,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `Heading ${node.attrs.level}`;
          }
          return 'Press "/" for commands';
        },
        includeChildren: true
      }),
      Command.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return items.filter(
              (item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.description.toLowerCase().includes(query.toLowerCase())
            );
          }
        }
      }),
      MathExtension.configure({
        delimiters: "dollar",
        katexOptions: {
          throwOnError: false,
          strict: false,
          trust: true,
          macros: katexMacros
        }
      }),
      TabExtension
    ],
    content,
    onUpdate: ({ editor: uEditor }) => {
      onChange(uEditor.getHTML());
    },
    onFocus: () => {
      onFocus?.();
    }
  });

  // Function to apply highlighting to existing clickable areas using TipTap's Highlight extension
  const applyClickableAreaHighlighting = useCallback(() => {
    if (!editor) return;

    // Clear ALL existing clickable area highlights first
    const { tr } = editor.state;
    let transaction = tr;
    let hasChanges = false;

    editor.state.doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach((mark) => {
          if (mark.type.name === "highlight" && mark.attrs.color?.startsWith("clickable-")) {
            transaction = transaction.removeMark(pos, pos + node.nodeSize, mark.type);
            hasChanges = true;
          }
        });
      }
    });

    // Apply transaction to clear highlights
    if (hasChanges) {
      editor.view.dispatch(transaction);
    }

    // Only apply new highlighting if there are clickable areas
    if (clickableAreas.length === 0) {
      return;
    }

    // Apply highlighting for each remaining clickable area
    clickableAreas.forEach((area) => {
      const docSize = editor.state.doc.content.size;

      // Validate positions are within document bounds
      if (area.startOffset >= 0 && area.endOffset <= docSize && area.startOffset < area.endOffset) {
        try {
          const colorAttribute = area.isCorrect ? "clickable-correct" : "clickable-incorrect";

          editor
            .chain()
            .setTextSelection({ from: area.startOffset, to: area.endOffset })
            .setHighlight({ color: colorAttribute })
            .run();
        } catch (error) {
          console.warn(`Failed to apply highlight for area ${area.id}:`, error);
          // Fallback: try to find by text content if positions are invalid
          let found = false;
          let docStartPos = -1;
          let docEndPos = -1;

          editor.state.doc.descendants((node, pos) => {
            if (found) return false;

            if (node.isText && node.text) {
              const textContent = node.text;
              const textIndex = textContent.indexOf(area.text);

              if (textIndex !== -1) {
                docStartPos = pos + textIndex;
                docEndPos = docStartPos + area.text.length;
                found = true;
                return false;
              }
            }
          });

          if (found && docStartPos !== -1 && docEndPos !== -1) {
            try {
              const colorAttribute = area.isCorrect ? "clickable-correct" : "clickable-incorrect";

              editor
                .chain()
                .setTextSelection({ from: docStartPos, to: docEndPos })
                .setHighlight({ color: colorAttribute })
                .run();
            } catch (fallbackError) {
              console.warn(`Fallback highlighting also failed for area ${area.id}:`, fallbackError);
            }
          }
        }
      }
    });

    // Clear selection
    try {
      editor.commands.setTextSelection(0);
    } catch (error) {
      // Ignore selection errors
    }
  }, [editor, clickableAreas]);

  // Apply highlighting when clickable areas change
  useEffect(() => {
    if (editor && clickableAreas) {
      applyClickableAreaHighlighting();
    }
  }, [clickableAreas, applyClickableAreaHighlighting]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      // Apply highlighting after content is set
      setTimeout(() => applyClickableAreaHighlighting(), 100);
    }
  }, [content, editor, applyClickableAreaHighlighting]);

  if (!editor) {
    return null;
  }

  const handleMarkArea = (isCorrect: boolean) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");

    // Check if there's actually a text selection (from !== to means there's a selection)
    if (from !== to && selectedText.trim().length > 0) {
      // Apply immediate highlighting using TipTap's official Highlight extension
      const colorAttribute = isCorrect ? "clickable-correct" : "clickable-incorrect";

      editor.chain().focus().setHighlight({ color: colorAttribute }).run();

      console.log("About to call onAddClickableArea with:", {
        selectedText: selectedText.trim(),
        isCorrect,
        from,
        to
      });

      // Add to clickable areas with correct positions
      onAddClickableArea(selectedText.trim(), isCorrect, from, to);
    } else {
      console.log("No text selected, not adding clickable area. From:", from, "To:", to);
      // Optionally show a toast or alert to inform the user
      console.warn("Please select some text before marking it as correct or incorrect.");
    }
  };

  // Function to sync clickable areas with editor content changes
  const syncClickableAreasWithContent = useCallback(() => {
    if (!editor || !clickableAreas.length) return;

    const updatedAreas: ClickableArea[] = [];

    clickableAreas.forEach((area) => {
      // Check if the area's text still exists in the document
      const textAtPosition = editor.state.doc.textBetween(area.startOffset, area.endOffset, " ");

      if (textAtPosition === area.text) {
        // Text matches at current position - keep the area
        updatedAreas.push(area);
      } else {
        // Text doesn't match - try to find it elsewhere in the document
        const fullText = editor.state.doc.textContent;
        const newIndex = fullText.indexOf(area.text);

        if (newIndex !== -1) {
          // Found the text at a new position - update the area
          const updatedArea: ClickableArea = {
            ...area,
            startOffset: newIndex,
            endOffset: newIndex + area.text.length
          };
          updatedAreas.push(updatedArea);
        }
        // If text is not found anywhere, the area is effectively deleted (not added to updatedAreas)
      }
    });

    // Only update if there are actual changes
    if (
      updatedAreas.length !== clickableAreas.length ||
      !updatedAreas.every((area, index) => {
        const originalArea = clickableAreas[index];
        return (
          originalArea &&
          area.startOffset === originalArea.startOffset &&
          area.endOffset === originalArea.endOffset
        );
      })
    ) {
      onUpdateClickableAreas(updatedAreas);
    }
  }, [editor, clickableAreas, onUpdateClickableAreas]);

  // Function to handle more sophisticated position tracking
  const updateClickableAreaPositions = useCallback(() => {
    if (!editor || !clickableAreas.length) return;

    const updatedAreas: ClickableArea[] = [];

    // Walk through the document and find all clickable area highlights
    const highlightedRanges: Array<{ area: ClickableArea; from: number; to: number }> = [];

    editor.state.doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach((mark) => {
          if (mark.type.name === "highlight" && mark.attrs.color?.startsWith("clickable-")) {
            const isCorrect = mark.attrs.color === "clickable-correct";
            const nodeText = node.textContent;
            const from = pos;
            const to = pos + node.nodeSize;

            // Find corresponding clickable area
            const matchingArea = clickableAreas.find(
              (area) => area.text === nodeText && area.isCorrect === isCorrect
            );

            if (matchingArea) {
              highlightedRanges.push({
                area: { ...matchingArea, startOffset: from, endOffset: to },
                from,
                to
              });
            }
          }
        });
      }
    });

    // Update areas based on current highlighting in the document
    const processedAreaIds = new Set<string>();

    highlightedRanges.forEach(({ area }) => {
      if (!processedAreaIds.has(area.id)) {
        updatedAreas.push(area);
        processedAreaIds.add(area.id);
      }
    });

    // Check for areas that lost their highlighting
    clickableAreas.forEach((area) => {
      if (!processedAreaIds.has(area.id)) {
        // Area no longer has highlighting - check if text still exists
        const currentText = editor.state.doc.textContent;
        if (currentText.includes(area.text)) {
          // Text exists but not highlighted - keep area but update position
          const textIndex = currentText.indexOf(area.text);
          if (textIndex !== -1) {
            updatedAreas.push({
              ...area,
              startOffset: textIndex,
              endOffset: textIndex + area.text.length
            });
          }
        }
        // If text doesn't exist, area is removed (not added to updatedAreas)
      }
    });

    // Update if there are changes
    if (
      updatedAreas.length !== clickableAreas.length ||
      !updatedAreas.every((area) => {
        const originalArea = clickableAreas.find((orig) => orig.id === area.id);
        return (
          originalArea &&
          originalArea.startOffset === area.startOffset &&
          originalArea.endOffset === area.endOffset
        );
      })
    ) {
      onUpdateClickableAreas(updatedAreas);
    }
  }, [editor, clickableAreas, onUpdateClickableAreas]);

  // Add editor update listener for content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Debounce the sync to avoid excessive updates
      const timeoutId = setTimeout(() => {
        syncClickableAreasWithContent();
      }, 300);

      return () => clearTimeout(timeoutId);
    };

    // Listen for transaction updates
    const handleTransaction = () => {
      // Use shorter timeout for transaction-based updates
      const timeoutId = setTimeout(() => {
        updateClickableAreaPositions();
      }, 100);

      return () => clearTimeout(timeoutId);
    };

    editor.on("update", handleUpdate);
    editor.on("transaction", handleTransaction);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("transaction", handleTransaction);
    };
  }, [editor, syncClickableAreasWithContent, updateClickableAreaPositions]);

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorHeader}>
        <Button
          icon="pi pi-question-circle"
          text
          size="small"
          onClick={showModal}
          className={styles.helpButton}
          tooltip="Editor Help"
          tooltipOptions={{ position: "left" }}
        />
      </div>

      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className={styles.bubbleMenu}>
        <button
          onClick={() => {
            handleMarkArea(true);
            // handleHighlight(true);
          }}
          className={styles.correctButton}
          title="Mark as Correct"
        >
          <i className="fa-solid fa-check" style={{ color: "#22c55e" }} />
        </button>
        <button
          onClick={() => {
            handleMarkArea(false);
            // handleHighlight(false);
          }}
          className={styles.incorrectButton}
          title="Mark as Incorrect"
        >
          <i className="fa-solid fa-xmark" style={{ color: "#ef4444" }} />
        </button>
      </BubbleMenu>

      <EditorContent editor={editor} className={styles.editor} />

      <TipTapDocModal visible={visible} onHide={hideModal} />
    </div>
  );
};
