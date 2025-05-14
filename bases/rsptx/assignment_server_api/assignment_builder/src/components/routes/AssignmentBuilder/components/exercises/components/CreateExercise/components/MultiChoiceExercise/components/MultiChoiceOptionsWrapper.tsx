import { FC } from "react";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { MultiChoiceOptions, OptionWithId } from "../MultiChoiceOptions";

interface MultiChoiceOptionsWrapperProps {
  options: OptionWithId[];
  onChange: (options: OptionWithId[]) => void;
}

export const MultiChoiceOptionsWrapper: FC<MultiChoiceOptionsWrapperProps> = ({
  options,
  onChange
}) => {
  return (
    <div className={styles.optionsContainer}>
      <MultiChoiceOptions options={options} onChange={onChange} />
    </div>
  );
};
