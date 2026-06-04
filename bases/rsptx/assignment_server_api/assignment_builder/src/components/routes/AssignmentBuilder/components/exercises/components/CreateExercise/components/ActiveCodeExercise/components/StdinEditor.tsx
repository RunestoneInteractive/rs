import { Textarea } from "@mantine/core";
import { FC } from "react";

import styles from "./StdinEditor.module.css";

interface StdinEditorProps {
  stdin: string;
  onChange: (stdin: string) => void;
}

export const StdinEditor: FC<StdinEditorProps> = ({ stdin, onChange }) => {
  return (
    <div>
      <Textarea
        id="stdin-input"
        value={stdin}
        onChange={(e) => onChange(e.target.value)}
        autosize
        minRows={6}
        placeholder={"Enter input data…\nLine 1\nLine 2\nLine 3"}
      />
      <small className={styles.hint}>
        Tip: Each line you enter here will be available as a line of input to the student's program.
      </small>
    </div>
  );
};
