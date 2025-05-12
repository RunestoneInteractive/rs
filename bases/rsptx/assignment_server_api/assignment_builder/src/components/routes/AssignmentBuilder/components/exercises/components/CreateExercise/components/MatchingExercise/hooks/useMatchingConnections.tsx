import { Toast } from "primereact/toast";
import { RefObject, useCallback, useEffect, useState } from "react";

import styles from "../MatchingExercise.module.css";
import { MatchingData } from "../types";

interface UseMatchingConnectionsProps {
  formData: MatchingData;
  updateFormData: (field: keyof MatchingData, value: any) => void;
  containerRef: RefObject<HTMLDivElement>;
  toastRef: RefObject<Toast>;
}

export const useMatchingConnections = ({
  formData,
  updateFormData,
  containerRef,
  toastRef
}: UseMatchingConnectionsProps) => {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hasMovedEnough, setHasMovedEnough] = useState(false);
  const [forceRedraw, setForceRedraw] = useState(0);

  const triggerConnectionsRedraw = useCallback(() => {
    setForceRedraw((prev) => prev + 1);
  }, []);

  const getScrollableContainer = useCallback(() => {
    if (!containerRef.current) return null;
    return containerRef.current.querySelector(`.${styles.columnsContent}`);
  }, [containerRef]);

  const getBlockPosition = useCallback(
    (blockId: string, isLeft: boolean) => {
      const scrollableContainer = getScrollableContainer();

      if (!scrollableContainer) return null;

      const block = scrollableContainer.querySelector(`[data-block-id="${blockId}"]`);

      if (!block) return null;

      const column = block.closest(`.${styles.column}`);

      if (!column) return null;

      const containerRect = scrollableContainer.getBoundingClientRect();
      const blockRect = block.getBoundingClientRect();
      const columnRect = column.getBoundingClientRect();

      const scrollTop = scrollableContainer.scrollTop;

      const y = blockRect.top - containerRect.top + scrollTop + blockRect.height / 2;

      const x = isLeft
        ? columnRect.right - containerRect.left
        : columnRect.left - containerRect.left;

      return { x, y };
    },
    [getScrollableContainer]
  );

  const handleStartConnection = useCallback(
    (sourceId: string) => {
      setActiveSource(sourceId);
      setHasMovedEnough(false);

      const isLeftSource = sourceId.startsWith("left-");
      const position = getBlockPosition(sourceId, isLeftSource);

      if (position) {
        setMousePosition(position);
      }
    },
    [getBlockPosition]
  );

  const handleCompleteConnection = useCallback(
    (targetId: string) => {
      if (!activeSource) return;

      const isSourceLeft = activeSource.startsWith("left-");
      const isTargetLeft = targetId.startsWith("left-");

      if (isSourceLeft === isTargetLeft) {
        toastRef.current?.show({
          severity: "warn",
          summary: "Invalid Connection",
          detail: "Cannot connect items on the same side",
          life: 3000
        });
        setActiveSource(null);
        return;
      }

      const connection: [string, string] = isSourceLeft
        ? [activeSource, targetId]
        : [targetId, activeSource];

      const connectionExists = (formData.correctAnswers || []).some(
        ([leftId, rightId]) => leftId === connection[0] && rightId === connection[1]
      );

      if (connectionExists) {
        toastRef.current?.show({
          severity: "warn",
          summary: "Connection Exists",
          detail: "This specific connection already exists",
          life: 3000
        });
        setActiveSource(null);
        return;
      }

      updateFormData("correctAnswers", [...(formData.correctAnswers || []), connection]);
      setActiveSource(null);
    },
    [activeSource, formData.correctAnswers, updateFormData, toastRef]
  );

  const handleDeleteConnection = useCallback(
    (sourceId: string, targetId: string) => {
      const updatedConnections = (formData.correctAnswers || []).filter(
        ([src, tgt]) => !(src === sourceId && tgt === targetId)
      );

      updateFormData("correctAnswers", updatedConnections);
      triggerConnectionsRedraw();
    },
    [formData.correctAnswers, updateFormData, triggerConnectionsRedraw]
  );

  const generatePath = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const distance = end.x - start.x;

      const control1 = {
        x: start.x + distance / 3,
        y: start.y
      };

      const control2 = {
        x: end.x - distance / 3,
        y: end.y
      };

      return `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`;
    },
    []
  );

  useEffect(() => {
    if (!activeSource) return;

    const handleMouseMove = (e: MouseEvent) => {
      const scrollableContainer = getScrollableContainer();

      if (!scrollableContainer) return;

      const containerRect = scrollableContainer.getBoundingClientRect();
      const scrollTop = scrollableContainer.scrollTop;

      const newPosition = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top + scrollTop
      };

      setMousePosition(newPosition);
      setHasMovedEnough(true);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);

      const isSourceLeft = activeSource.startsWith("left-");

      const targetBlock = elements.find((el) => {
        if (!(el instanceof HTMLElement)) return false;

        if (!el.dataset.blockId) return false;

        const isTargetLeft = el.dataset.blockId.startsWith("left-");

        return isSourceLeft !== isTargetLeft;
      }) as HTMLElement | undefined;

      if (targetBlock && targetBlock.dataset.blockId) {
        handleCompleteConnection(targetBlock.dataset.blockId);
      } else {
        setActiveSource(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveSource(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSource, getScrollableContainer, handleCompleteConnection]);

  useEffect(() => {
    const scrollableContainer = getScrollableContainer();

    if (!scrollableContainer) return;

    const handleScroll = () => {
      triggerConnectionsRedraw();

      if (activeSource) {
        const isLeftSource = activeSource.startsWith("left-");
        const sourcePosition = getBlockPosition(activeSource, isLeftSource);

        if (sourcePosition && !hasMovedEnough) {
          setMousePosition(sourcePosition);
        }
      }
    };

    const handleResize = () => {
      triggerConnectionsRedraw();
    };

    scrollableContainer.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      scrollableContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [
    activeSource,
    hasMovedEnough,
    getBlockPosition,
    getScrollableContainer,
    triggerConnectionsRedraw
  ]);

  return {
    activeSource,
    mousePosition,
    hasMovedEnough,
    forceRedraw,
    triggerConnectionsRedraw,
    getBlockPosition,
    generatePath,
    handleStartConnection,
    handleCompleteConnection,
    handleDeleteConnection
  };
};
