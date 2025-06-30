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
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";
import { getLeafNodes, getSelectedKeys } from "@/utils/exercise";

export const ChooseExercises = () => {
  const dispatch = useDispatch();
  const { assignmentExercises = [] } = useExercisesSelector();
  const availableExercises = useSelector(exercisesSelectors.getAvailableExercises);

  const selectedKeys = useSelector(chooseExercisesSelectors.getSelectedKeys);
  const selectedExercises = useSelector(chooseExercisesSelectors.getSelectedExercises);

  const updateState = (selEx: Exercise[]) => {
    dispatch(chooseExercisesActions.setSelectedExercises(selEx));

    dispatch(
      chooseExercisesActions.setSelectedKeys({
        ...selectedKeys,
        ...getSelectedKeys(availableExercises, selEx)
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
        getSelectedKeys(availableExercises, assignmentExercises)
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
      value={availableExercises}
      resizableColumns
      className="table_sticky-header"
      header={<ChooseExercisesHeader resetSelections={resetSelections} />}
    >
      <Column
        style={{ width: "45%" }}
        field="title"
        header="Select exercises"
        expander
        bodyClassName={(_, options) => {
          return options.props.node.disabled ? "treetable-no-checkbox" : "";
        }}
      ></Column>
      <Column style={{ width: "15%" }} field="qnumber" header="Question number"></Column>
      <Column style={{ width: "20%" }} field="name" header="Name"></Column>
      <Column
        style={{ width: "5rem" }}
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
      ></Column>
      <Column style={{ width: "15%" }} field="question_type" header="Question type"></Column>
      <Column
        style={{ width: "10%" }}
        field="from_source"
        header="Source"
        body={({ data }: { data: Exercise }) => {
          if (data.from_source === undefined) return;
          return <i className={data.from_source ? "pi pi-book" : "pi pi-user"} />;
        }}
      />
    </TreeTable>
  );
};
