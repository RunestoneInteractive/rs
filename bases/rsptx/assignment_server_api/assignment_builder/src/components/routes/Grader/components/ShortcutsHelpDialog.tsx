import { Modal } from "@mantine/core";
import React from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "../Grader.module.css";
import { Platform } from "../hooks/usePlatform";

interface Props {
  visible: boolean;
  onHide: () => void;
  platform: Platform;
}

interface Row {
  keys: string[];
  label: string;
}

const SECTIONS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "Navigation",
    rows: [
      { keys: ["J"], label: "Next student (rolls over to next question)" },
      { keys: ["K"], label: "Previous student (rolls over to previous question)" },
      { keys: ["↓"], label: "Next student" },
      { keys: ["↑"], label: "Previous student" },
      { keys: ["→"], label: "Next attempt" },
      { keys: ["←"], label: "Previous attempt" }
    ]
  },
  {
    title: "Focus & input",
    rows: [
      { keys: ["G"], label: "Focus grade input" },
      { keys: ["C"], label: "Focus comment box" },
      { keys: ["H"], label: "Toggle 'hide graded' filter" }
    ]
  },
  {
    title: "Help",
    rows: [{ keys: ["?"], label: "Open this dialog" }]
  }
];

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className={styles.kbd}>{children}</kbd>
);

export const ShortcutsHelpDialog: React.FC<Props> = ({ visible, onHide }) => {
  return (
    <Modal
      opened={visible}
      onClose={onHide}
      title={
        <span className={styles.dialogTitleRow}>
          <Icon name="bolt" className={styles.dialogHeaderIcon} />
          Keyboard shortcuts
        </span>
      }
      size="min(560px, 95vw)"
      centered
    >
      <div className={styles.dialogStack}>
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h4 className={styles.sectionLabel}>{s.title}</h4>
            <table className={styles.shortcutTable}>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} className={styles.shortcutRow}>
                    <td>
                      {r.keys.map((k, j) => (
                        <React.Fragment key={j}>
                          {k === "–" ? <span className={styles.kbdSep}>–</span> : <Kbd>{k}</Kbd>}
                          {j < r.keys.length - 1 && k !== "–" && r.keys[j + 1] !== "–" && (
                            <span className={styles.kbdSep}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </td>
                    <td className={styles.shortcutDesc}>{r.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className={styles.dialogFootnote}>
          Letter shortcuts are ignored while a text field has focus. Finish typing, then click
          outside the field to use them.
          <br />
          Tip: enable <strong>Auto-advance after save</strong> in the grade panel to jump to the
          next ungraded student automatically. You can always undo from the toast that appears.
        </div>
      </div>
    </Modal>
  );
};
