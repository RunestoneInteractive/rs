import { useDialogContext } from "@components/ui/DialogContext";
import { readingsActions, readingsSelectors } from "@store/readings/readings.logic";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { OverlayPanel } from "primereact/overlaypanel";
import { TreeTable, TreeTableEvent } from "primereact/treetable";
import { useRef } from "react";
import { MouseEvent } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";
import { getLeafNodes } from "@/utils/exercise";

type ButtonEvent = MouseEvent<HTMLButtonElement>;
export const AssignmentReadingsHeader = () => {
  const dispatch = useDispatch();
  const { showDialog } = useDialogContext();
  const { selectedKeys, readingExercises = [] } = useReadingsSelector();
  const overlayRef = useRef<OverlayPanel>(null);
  const selectedReadings = useSelector(readingsSelectors.getSelectedReadings);
  const availableReadings = useSelector(readingsSelectors.getAvailableReadings);
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();

  const setSelectedReadings = (readings: Exercise[]) => {
    dispatch(readingsActions.setSelectedReadings(readings));
  };

  const toggleAddReadingsOverlay = (event: ButtonEvent) => {
    overlayRef.current?.toggle(event);
  };

  const onRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: `Are you sure you want to remove ${selectedReadings.length} readings?`,
      icon: "pi pi-exclamation-triangle",
      defaultFocus: "accept",
      accept: async () => {
        await updateAssignmentExercises(
          {
            idsToRemove: selectedReadings.map((x) => x.id),
            isReading: true
          },
          () => {
            setSelectedReadings([]);
          }
        );
      }
    });
  };

  const title = "Sections to Read";

  const onInfoButtonClick = () => {
    showDialog({
      style: { width: "50vw" },
      header: title,
      children: (
        <p className="m-0">
          Reading assignments are meant to encourage students to do the reading, by giving them
          points for interacting with various interactive elements that are a part of the page. The
          number of activities required is set to 80% of the number of questions in the reading.
          Readings assignments are meant to be <strong>formative</strong> and therefore the
          questions are not graded for correctness, rather the students are given points for
          interacting with them.
        </p>
      )
    });
  };

  const onSelect = async ({ node }: Omit<TreeTableEvent, "originalEvent">) => {
    const entriesToAdd = getLeafNodes([node]).map((x) => x.data as Exercise);

    await updateAssignmentExercises({
      idsToAdd: entriesToAdd.map((x) => x.id),
      isReading: true
    });
  };

  const onUnselect = async ({ node }: Omit<TreeTableEvent, "originalEvent">) => {
    const entriesToRemove = getLeafNodes([node]).map((x) => x.data as Exercise);
    const entriesIdsToRemove = entriesToRemove.map((x) => x.id);
    const idsToRemove = readingExercises
      .filter((ex) => entriesIdsToRemove.includes(ex.question_id))
      .map((x) => x.id);

    await updateAssignmentExercises({
      idsToRemove,
      isReading: true
    });
  };

  return (
    <div className="flex flex-row justify-content-between">
      <div className="flex flex-row gap-2 align-items-center">
        <ConfirmPopup />
        {!!selectedReadings.length && (
          <Button
            onClick={onRemoveClick}
            icon="pi pi-trash"
            label={`Remove ${selectedReadings.length} readings`}
            size="small"
            severity="danger"
          ></Button>
        )}
        {!selectedReadings.length && (
          <div className="flex align-items-center gap-2 ml-2">
            <span className="p-panel-title">{title}</span>
            <button className="p-panel-header-icon p-link mr-2">
              <span>
                <i className="pi pi-info-circle" onClick={onInfoButtonClick}></i>
              </span>
            </button>
          </div>
        )}
      </div>
      <div>
        <Button
          type="button"
          label="Choose Readings"
          onClick={toggleAddReadingsOverlay}
          size="small"
        />
        <OverlayPanel
          ref={overlayRef}
          id="overlay_panel_choose_readings"
          style={{ width: "450px" }}
        >
          <TreeTable
            selectionMode="checkbox"
            selectionKeys={selectedKeys}
            onSelect={onSelect}
            onUnselect={onUnselect}
            scrollable
            scrollHeight="50vh"
            value={availableReadings}
          >
            <Column field="title" header="Select readings" expander></Column>
          </TreeTable>
        </OverlayPanel>
      </div>
    </div>
  );
};
