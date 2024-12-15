import { readingsActions, readingsSelectors } from "@store/readings/readings.logic";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { OverlayPanel } from "primereact/overlaypanel";
import { TreeTable } from "primereact/treetable";
import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { Exercise } from "@/types/exercises";

type ButtonEvent = React.MouseEvent<HTMLButtonElement>;
export const AssignmentReadingsHeader = () => {
  const dispatch = useDispatch();
  const {
    selectReadingsData,
    selectedKeys,
    addReadings,
    removeReadingsFromAvailableReadings,
    removeReadings
  } = useReadingsSelector();
  const overlayRef = useRef<OverlayPanel>(null);
  const selectedReadings = useSelector(readingsSelectors.getSelectedReadings);

  const setSelectedReadings = (readings: Exercise[]) => {
    dispatch(readingsActions.setSelectedReadings(readings));
  };

  const toggleAddReadingsOverlay = (event: ButtonEvent) => {
    overlayRef.current?.toggle(event);
  };

  const onRemoveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: `Are you sure you want to remove ${selectedReadings.length} readings?`,
      icon: "pi pi-exclamation-triangle",
      defaultFocus: "accept",
      accept: () => {
        removeReadings?.(selectedReadings);
        setSelectedReadings([]);
      }
    });
  };

  return (
    <div className="flex flex-row justify-content-between">
      {/*<div>// TODO: Add hiNT</div>*/}
      <div>
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
            onSelect={addReadings}
            onUnselect={removeReadingsFromAvailableReadings}
            scrollable
            scrollHeight="50vh"
            value={selectReadingsData}
          >
            <Column field="title" header="Select readings" expander></Column>
          </TreeTable>
        </OverlayPanel>
      </div>
    </div>
  );
};
