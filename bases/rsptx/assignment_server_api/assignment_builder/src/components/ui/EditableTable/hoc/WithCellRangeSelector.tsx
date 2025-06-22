import { useState, MouseEvent, ComponentType } from "react";

import { EditableCellFactoryProps, EditableCellProps } from "@/types/components/editableTableCell";

export const withCellRangeSelector = <P extends EditableCellFactoryProps>(
  WrappedComponent: ComponentType<EditableCellProps>
) => {
  return ({
    fieldName,
    itemId,
    handleMouseDown,
    handleChange,
    value,
    isDragging,
    ...props
  }: EditableCellFactoryProps & P) => {
    const [isDragIconVisible, setIsDragIconVisible] = useState(false);

    const hideDragIcon = () => {
      setIsDragIconVisible(false);
    };

    const showDragIcon = () => {
      setIsDragIconVisible(true);
    };

    const handleDragIconPress = (e: MouseEvent<HTMLElement>) => {
      handleMouseDown(itemId, fieldName);
      e.stopPropagation();
    };

    return (
      <div
        className="editable-table-cell"
        style={{ position: "relative" }}
        onMouseEnter={showDragIcon}
        onMouseLeave={hideDragIcon}
      >
        <WrappedComponent
          {...(props as P)}
          handleChange={handleChange}
          hideDragIcon={hideDragIcon}
          itemId={itemId}
          value={value}
        />
        {isDragIconVisible && !isDragging && (
          <i
            className="pi pi-plus absolute editable-table-cell__drag-icon"
            onMouseDown={handleDragIconPress}
          />
        )}
      </div>
    );
  };
};
