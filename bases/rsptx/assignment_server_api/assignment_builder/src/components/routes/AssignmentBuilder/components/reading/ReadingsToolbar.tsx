import { SearchInput } from "@components/ui/SearchInput";
import { readingsActions, readingsSelectors } from "@store/readings/readings.logic";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { ConfirmPopup } from "primereact/confirmpopup";
import { OverlayPanel } from "primereact/overlaypanel";
import { TreeTable, TreeTableEvent } from "primereact/treetable";
import { useRef } from "react";
import { MouseEvent } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";
import { getLeafNodes } from "@/utils/exercise";

interface ReadingsToolbarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  selectedReadings: Exercise[];
  handleRemoveSelected: () => void;
}

type ButtonEvent = MouseEvent<HTMLButtonElement>;

export const ReadingsToolbar = ({
  globalFilter,
  setGlobalFilter,
  selectedReadings,
  handleRemoveSelected
}: ReadingsToolbarProps) => {
  const dispatch = useDispatch();
  const { selectedKeys, readingExercises = [] } = useReadingsSelector();
  const overlayRef = useRef<OverlayPanel>(null);
  const availableReadings = useSelector(readingsSelectors.getAvailableReadings);
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();

  const setSelectedReadings = (readings: Exercise[]) => {
    dispatch(readingsActions.setSelectedReadings(readings));
  };

  const toggleAddReadingsOverlay = (event: ButtonEvent) => {
    overlayRef.current?.toggle(event);
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
    <div className="flex justify-content-between align-items-center mb-3">
      <div className="flex-grow-1">
        <SearchInput
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder="Search readings..."
          className="w-full"
        />
      </div>
      <div className="flex gap-2 ml-3">
        <ConfirmPopup />
        {selectedReadings.length > 0 && (
          <Button
            icon="pi pi-trash"
            severity="danger"
            tooltip="Remove Selected"
            tooltipOptions={{ position: "top" }}
            onClick={handleRemoveSelected}
          />
        )}
        <Button
          label="Choose Readings"
          icon="pi pi-book"
          onClick={toggleAddReadingsOverlay}
          severity="success"
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
