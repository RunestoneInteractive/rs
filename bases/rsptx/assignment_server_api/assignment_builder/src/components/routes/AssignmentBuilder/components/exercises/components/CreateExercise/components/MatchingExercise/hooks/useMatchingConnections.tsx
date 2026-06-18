import { RefObject, useCallback, useEffect, useState } from "react";

import { notify } from "@/components/ui/notify";

import { CONNECTION_TOAST_COPY, blockSide } from "../../../shared/connections";

import styles from "../MatchingExercise.module.css";
import { MatchingData } from "../types";

interface UseMatchingConnectionsProps {
  formData: MatchingData;
  updateFormData: <K extends keyof MatchingData>(field: K, value: MatchingData[K]) => void;
  containerRef: RefObject<HTMLDivElement>;
}

export const useMatchingConnections = ({
  formData,
  updateFormData,
  containerRef
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

      const isLeftSource = blockSide(formData.left || [], formData.right || [], sourceId) === "left";
      const position = getBlockPosition(sourceId, isLeftSource);

      if (position) {
        setMousePosition(position);
      }
    },
    [formData.left, formData.right, getBlockPosition]
  );

  const handleCompleteConnection = useCallback(
    (targetId: string) => {
      if (!activeSource) return;

      const left = formData.left || [];
      const right = formData.right || [];
      const isSourceLeft = blockSide(left, right, activeSource) === "left";
      const isTargetLeft = blockSide(left, right, targetId) === "left";

      if (isSourceLeft === isTargetLeft) {
        notify.show({
          title: CONNECTION_TOAST_COPY.sameSideTitle,
          message: CONNECTION_TOAST_COPY.sameSideMessage,
          color: "yellow",
          autoClose: 3000
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
        notify.show({
          title: CONNECTION_TOAST_COPY.duplicateTitle,
          message: CONNECTION_TOAST_COPY.duplicateMessage,
          color: "yellow",
          autoClose: 3000
        });
        setActiveSource(null);
        return;
      }

      updateFormData("correctAnswers", [...(formData.correctAnswers || []), connection]);
      setActiveSource(null);
    },
    [activeSource, formData.left, formData.right, formData.correctAnswers, updateFormData]
  );

  const cancelConnection = useCallback(() => {
    setActiveSource(null);
  }, []);

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

      const left = formData.left || [];
      const right = formData.right || [];
      const isSourceLeft = blockSide(left, right, activeSource) === "left";

      const targetBlock = elements.find((el) => {
        if (!(el instanceof HTMLElement)) return false;

        if (!el.dataset.blockId) return false;

        const isTargetLeft = blockSide(left, right, el.dataset.blockId) === "left";

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
  }, [activeSource, formData.left, formData.right, getScrollableContainer, handleCompleteConnection]);

  useEffect(() => {
    const scrollableContainer = getScrollableContainer();

    if (!scrollableContainer) return;

    const handleScroll = () => {
      triggerConnectionsRedraw();

      if (activeSource) {
        const isLeftSource = blockSide(formData.left || [], formData.right || [], activeSource) === "left";
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
    formData.left,
    formData.right,
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
    cancelConnection,
    handleDeleteConnection
  };
};
