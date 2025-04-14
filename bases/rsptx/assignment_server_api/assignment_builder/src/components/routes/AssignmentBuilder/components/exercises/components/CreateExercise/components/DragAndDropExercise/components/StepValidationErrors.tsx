import { FC, useMemo } from "react";

import { isTipTapContentEmpty } from "../../../utils/validation";
import styles from "../DragAndDropExercise.module.css";
import { DragAndDropData } from "../types";

interface StepValidationErrorsProps {
  formData: DragAndDropData;
}

export const StepValidationErrors: FC<StepValidationErrorsProps> = ({ formData }) => {
  const { hasNoConnections, hasEmptyBlocks, duplicateSourceIds, duplicateTargetIds } =
    useMemo(() => {
      // Check for no connections
      const hasNoConnections = !formData.connections || formData.connections.length === 0;

      // Check for empty blocks
      const hasEmptyBlocks = [
        ...(formData.leftColumnBlocks || []),
        ...(formData.rightColumnBlocks || [])
      ].some((block) => isTipTapContentEmpty(block.content));

      // Check for duplicate connections
      const sourceIds = new Set();
      const targetIds = new Set();
      const duplicateSourceIds = new Set();
      const duplicateTargetIds = new Set();

      (formData.connections || []).forEach((conn) => {
        if (sourceIds.has(conn.sourceId)) {
          duplicateSourceIds.add(conn.sourceId);
        } else {
          sourceIds.add(conn.sourceId);
        }

        if (targetIds.has(conn.targetId)) {
          duplicateTargetIds.add(conn.targetId);
        } else {
          targetIds.add(conn.targetId);
        }
      });

      return {
        hasNoConnections,
        hasEmptyBlocks,
        duplicateSourceIds,
        duplicateTargetIds
      };
    }, [formData]);

  // Only show the validation container if there are errors
  if (
    !hasNoConnections &&
    !hasEmptyBlocks &&
    duplicateSourceIds.size === 0 &&
    duplicateTargetIds.size === 0
  ) {
    return null;
  }

  return (
    <div className={styles.validationError}>
      {hasNoConnections && (
        <div>
          <i className="fa-solid fa-circle-exclamation mr-2" />
          You need to create at least one connection between source items and their matching targets
        </div>
      )}

      {hasEmptyBlocks && (
        <div>
          <i className="fa-solid fa-circle-exclamation mr-2" />
          All blocks must have content
        </div>
      )}

      {duplicateSourceIds.size > 0 && (
        <div>
          <i className="fa-solid fa-circle-exclamation mr-2" />
          Some source items are connected to multiple targets. Each item can only have one
          connection.
        </div>
      )}

      {duplicateTargetIds.size > 0 && (
        <div>
          <i className="fa-solid fa-circle-exclamation mr-2" />
          Some target matches are connected to multiple sources. Each target can only have one
          connection.
        </div>
      )}
    </div>
  );
};
