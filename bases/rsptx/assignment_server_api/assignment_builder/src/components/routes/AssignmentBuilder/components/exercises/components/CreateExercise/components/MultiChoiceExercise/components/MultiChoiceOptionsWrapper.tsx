import { FC } from "react";

import { MultiChoiceOptions, OptionWithId } from "../MultiChoiceOptions";

import styles from "./MultiChoiceOptionsWrapper.module.css";
import { StatementPreview } from "./StatementPreview";

interface MultiChoiceOptionsWrapperProps {
  options: OptionWithId[];
  onChange: (options: OptionWithId[]) => void;
  statement: string;
}

export const MultiChoiceOptionsWrapper: FC<MultiChoiceOptionsWrapperProps> = ({
  options,
  onChange,
  statement
}) => {
  return (
    <div className={styles.verticalLayout}>
      <div className={styles.statementSection}>
        <StatementPreview statement={statement} />
      </div>
      <div className={styles.optionsSection}>
        <MultiChoiceOptions options={options} onChange={onChange} />
      </div>
    </div>
  );
};
