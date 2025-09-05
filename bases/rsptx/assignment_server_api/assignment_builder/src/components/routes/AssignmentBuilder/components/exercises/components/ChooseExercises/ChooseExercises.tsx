import { ChooseExercisesHeader } from "@components/routes/AssignmentBuilder/components/exercises/components/ChooseExercises/ChooseExercisesHeader";
import { ExercisePreviewModal } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreviewModal";
import {
  chooseExercisesActions,
  chooseExercisesSelectors
} from "@store/chooseExercises/chooseExercises.logic";
import { exercisesSelectors } from "@store/exercises/exercises.logic";
import { differenceBy } from "lodash";
import uniqBy from "lodash/uniqBy";
import { Column } from "primereact/column";
import { TreeTable, TreeTableEvent } from "primereact/treetable";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";
import {
  getLeafNodes,
  getSelectedKeys,
  filterExercisesByQuestionType,
  filterOutExercisesByQuestionType,
  filterExercisesByFromSource
} from "@/utils/exercise";

export const ChooseExercises = () => {
  const dispatch = useDispatch();
  const { assignmentExercises = [] } = useExercisesSelector();
  const availableExercises = useSelector(exercisesSelectors.getAvailableExercises);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>([]);
  const [fromSourceOnly, setFromSourceOnly] = useState<boolean>(false);

  const selectedKeys = useSelector(chooseExercisesSelectors.getSelectedKeys);
  const selectedExercises = useSelector(chooseExercisesSelectors.getSelectedExercises);

  const filteredExercises = filterExercisesByFromSource(
    filterOutExercisesByQuestionType(
      filterExercisesByQuestionType(availableExercises, selectedQuestionTypes),
      ["datafile"]
    ),
    fromSourceOnly
  );

  const updateState = (selEx: Exercise[]) => {
    dispatch(chooseExercisesActions.setSelectedExercises(selEx));

    dispatch(
      chooseExercisesActions.setSelectedKeys({
        ...selectedKeys,
        ...getSelectedKeys(filteredExercises, selEx)
      })
    );

    dispatch(
      chooseExercisesActions.setExercisesToAdd(
        differenceBy(selEx, assignmentExercises, (ex) => ex.question_id || ex.id)
      )
    );

    dispatch(
      chooseExercisesActions.setExercisesToRemove(
        differenceBy(assignmentExercises, selEx, (ex) => ex.question_id || ex.id)
      )
    );
  };

  const resetSelections = () => {
    dispatch(
      chooseExercisesActions.setSelectedKeys(
        getSelectedKeys(filteredExercises, assignmentExercises)
      )
    );
    dispatch(chooseExercisesActions.setSelectedExercises(assignmentExercises));
    dispatch(chooseExercisesActions.resetSelections());
  };

  const getExerciseId = (exercise: Exercise) => {
    return exercise.question_id || exercise.id;
  };

  const handleSelect = ({ node }: Omit<TreeTableEvent, "originalEvent">) => {
    const entriesToAdd = getLeafNodes([node]).map((x) => x.data as Exercise);

    const updatedSelectedExercises = uniqBy([...selectedExercises, ...entriesToAdd], (n) =>
      getExerciseId(n)
    );

    updateState(updatedSelectedExercises);
  };

  const handleUnselect = ({ node }: Omit<TreeTableEvent, "originalEvent">) => {
    const entriesToRemove = getLeafNodes([node]).map((x) => x.data as Exercise);

    const updatedSelectedExercises = selectedExercises.filter(
      (x) => !entriesToRemove.some((y) => getExerciseId(x) === y.id)
    );

    updateState(updatedSelectedExercises);
  };

  return (
    <TreeTable
      scrollable
      scrollHeight="95%"
      selectionMode="checkbox"
      selectionKeys={selectedKeys}
      onSelect={handleSelect}
      onUnselect={handleUnselect}
      value={filteredExercises}
      resizableColumns
      className="table_sticky-header header-gridlines-only"
      header={
        <ChooseExercisesHeader
          resetSelections={resetSelections}
          selectedQuestionTypes={selectedQuestionTypes}
          onQuestionTypeChange={setSelectedQuestionTypes}
          fromSourceOnly={fromSourceOnly}
          onFromSourceChange={setFromSourceOnly}
        />
      }
    >
      <Column
        style={{ width: "45%" }}
        field="title"
        header="Select exercises"
        expander
        bodyClassName={(_, options) => {
          return options.props.node.disabled ? "treetable-no-checkbox" : "";
        }}
      />
      <Column style={{ width: "15%" }} field="qnumber" header="Question number" />
      <Column style={{ width: "20%" }} field="name" header="Name" />
      <Column
        style={{ width: "6rem" }}
        field="htmlsrc"
        header="Preview"
        body={({ data }: { data: Exercise }) => {
          if (!data?.htmlsrc) {
            return null;
          }

          return (
            <ExercisePreviewModal
              htmlsrc={data.htmlsrc}
              triggerButton={<i className="pi pi-eye" style={{ cursor: "pointer" }} />}
            />
          );
        }}
      />
      <Column style={{ width: "15%" }} field="question_type" header="Question type" />
      <Column
        style={{ width: "10%" }}
        field="from_source"
        header="Source"
        sortable
        body={({ data }: { data: Exercise }) => {
          if (data.from_source === undefined) return;
          return <i className={data.from_source ? "pi pi-book" : "pi pi-user"} />;
        }}
      />
    </TreeTable>
  );
};
