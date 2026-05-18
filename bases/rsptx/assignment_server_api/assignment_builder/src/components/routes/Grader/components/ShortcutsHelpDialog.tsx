import { Dialog } from "primereact/dialog";
import React from "react";

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
  <kbd
    style={{
      display: "inline-block",
      minWidth: "1.6rem",
      padding: "0.1rem 0.45rem",
      borderRadius: 6,
      border: "1px solid #cbd5e1",
      background: "linear-gradient(180deg, #ffffff, #f1f5f9)",
      fontSize: 12,
      fontWeight: 700,
      fontFamily: "ui-monospace, SFMono-Regular, monospace",
      color: "#0f172a",
      textAlign: "center",
      boxShadow: "inset 0 -1px 0 #cbd5e1"
    }}
  >
    {children}
  </kbd>
);

export const ShortcutsHelpDialog: React.FC<Props> = ({ visible, onHide }) => {
  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <span>
          <i className="pi pi-bolt" style={{ color: "#6366f1", marginRight: 8 }} />
          Keyboard shortcuts
        </span>
      }
      style={{ width: "min(560px, 95vw)" }}
      draggable={false}
      modal
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h4
              style={{
                margin: "0 0 0.4rem 0",
                fontSize: 13,
                color: "#3730a3",
                textTransform: "uppercase",
                letterSpacing: 0.04
              }}
            >
              {s.title}
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.4rem 0.2rem" }}>
                      {r.keys.map((k, j) => (
                        <React.Fragment key={j}>
                          {k === "–" ? (
                            <span style={{ margin: "0 4px", color: "#94a3b8" }}>–</span>
                          ) : (
                            <Kbd>{k}</Kbd>
                          )}
                          {j < r.keys.length - 1 && k !== "–" && r.keys[j + 1] !== "–" && (
                            <span style={{ margin: "0 6px", color: "#94a3b8" }}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </td>
                    <td
                      style={{
                        padding: "0.4rem 0.2rem",
                        color: "#475569",
                        textAlign: "right"
                      }}
                    >
                      {r.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            borderTop: "1px solid #e2e8f0",
            paddingTop: 8
          }}
        >
          Letter shortcuts are ignored while a text field has focus — finish typing
          first, or click outside the field to leave it.
          <br />
          Tip: enable <strong>Auto-advance after save</strong> in the grade panel to
          jump to the next ungraded student automatically. You can always undo from
          the toast that appears.
        </div>
      </div>
    </Dialog>
  );
};
