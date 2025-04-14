import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { FC, useCallback, useMemo, useRef, useState, useEffect } from "react";

import { QuestionJSON } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { safeJsonParse } from "@/utils/json";
import { generateDragAndDropPreview } from "@/utils/preview/dndPreview";
import { buildQuestionJson } from "@/utils/questionJson";

import { DRAG_AND_DROP_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { ExerciseComponentProps } from "../../types/ExerciseTypes";
import { validateCommonFields } from "../../utils/validation";

import styles from "./DragAndDropExercise.module.css";
import { DragAndDropPreview } from "./DragAndDropPreview";
import { DragAndDropSettings } from "./DragAndDropSettings";
import { SortableBlock, DragAndDropInstructions } from "./components";
import { useDragAndDropConnections } from "./hooks";
import { DragBlock, DragAndDropData } from "./types";

const DRAG_AND_DROP_STEPS = [
  { label: "Statement" },
  { label: "Content" },
  { label: "Settings" },
  { label: "Preview" }
];

const getDefaultFormData = (): DragAndDropData => ({
  name: createExerciseId(),
  author: "",
  topic: "",
  chapter: "",
  tags: "",
  points: 1,
  difficulty: 3,
  htmlsrc: "",
  question_type: "dragndrop",
  statement: "",
  leftColumnBlocks: [{ id: `left-${Date.now()}`, content: "" }],
  rightColumnBlocks: [{ id: `right-${Date.now() + 1}`, content: "" }],
  connections: []
});

export const DragAndDropExercise: FC<ExerciseComponentProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
  const toastRef = useRef<Toast>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [_, setSvgHeight] = useState<number>(0);

  const parsedInitialData = useMemo(() => {
    if (isEdit && initialData) {
      const initialWithJson = initialData as any;
      const questionJson = safeJsonParse<QuestionJSON>(initialWithJson.question_json || "{}") || {};

      return {
        ...initialData,
        leftColumnBlocks: questionJson.leftColumnBlocks || getDefaultFormData().leftColumnBlocks,
        rightColumnBlocks: questionJson.rightColumnBlocks || getDefaultFormData().rightColumnBlocks,
        connections: questionJson.connections || getDefaultFormData().connections
      } as DragAndDropData;
    }

    return initialData as DragAndDropData;
  }, [initialData, isEdit]);

  const handleDragAndDropSave = useCallback(
    async (data: DragAndDropData) => {
      const htmlsrc = generateDragAndDropPreview({
        leftColumnBlocks: data.leftColumnBlocks || [],
        rightColumnBlocks: data.rightColumnBlocks || [],
        connections: data.connections || [],
        name: data.name || "",
        statement: data.statement || ""
      });

      const augmentedData = {
        ...data,
        htmlsrc,
        question_json: buildQuestionJson({
          ...data,
          question_type: "dragndrop"
        } as any)
      };

      await onSave(augmentedData as any);
    },
    [onSave]
  );

  const {
    formData,
    activeStep,
    isSaving,
    updateFormData,
    handleSettingsChange,
    handleQuestionChange,
    isCurrentStepValid,
    goToNextStep,
    goToPrevStep,
    handleSave: baseHandleSave,
    setActiveStep
  } = useBaseExercise<DragAndDropData>({
    initialData: parsedInitialData,
    steps: DRAG_AND_DROP_STEPS,
    exerciseType: "dragndrop",
    generatePreview: (data) =>
      generateDragAndDropPreview({
        leftColumnBlocks: data.leftColumnBlocks || [],
        rightColumnBlocks: data.rightColumnBlocks || [],
        connections: data.connections || [],
        name: data.name || "",
        statement: data.statement || ""
      }),
    validateStep: (step, data) => {
      const errors = DRAG_AND_DROP_STEP_VALIDATORS[step](data);

      return errors.length === 0;
    },
    validateForm: validateCommonFields,
    getDefaultFormData,
    onSave: handleDragAndDropSave,
    onCancel,
    resetForm,
    onFormReset,
    isEdit
  });

  // Use our centralized navigation and validation hook
  const { validation, handleNext, handleStepSelect, handleSave, stepsValidity } =
    useExerciseStepNavigation({
      data: formData,
      activeStep,
      setActiveStep,
      stepValidators: DRAG_AND_DROP_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: DRAG_AND_DROP_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: (data) =>
        generateDragAndDropPreview({
          leftColumnBlocks: data.leftColumnBlocks || [],
          rightColumnBlocks: data.rightColumnBlocks || [],
          connections: data.connections || [],
          name: data.name || "",
          statement: data.statement || ""
        }),
      updateFormData
    });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const {
    activeSource,
    forceRedraw,
    triggerConnectionsRedraw,
    handleStartConnection,
    handleCompleteConnection,
    handleDeleteConnection,
    getBlockPosition,
    generatePath,
    hasMovedEnough,
    mousePosition
  } = useDragAndDropConnections({
    formData,
    updateFormData,
    containerRef,
    toastRef
  });

  const handleAddLeftBlock = useCallback(() => {
    const newBlock: DragBlock = {
      id: `left-${Date.now()}`,
      content: ""
    };

    updateFormData("leftColumnBlocks", [...(formData.leftColumnBlocks || []), newBlock]);
  }, [formData.leftColumnBlocks, updateFormData]);

  const handleUpdateLeftBlock = useCallback(
    (id: string, content: string) => {
      const updatedBlocks = (formData.leftColumnBlocks || []).map((block) =>
        block.id === id ? { ...block, content } : block
      );

      updateFormData("leftColumnBlocks", updatedBlocks);
    },
    [formData.leftColumnBlocks, updateFormData]
  );

  const handleRemoveLeftBlock = useCallback(
    (id: string) => {
      const hasConnections = (formData.connections || []).some((conn) => conn.sourceId === id);

      if (hasConnections) {
        const updatedConnections = (formData.connections || []).filter(
          (conn) => conn.sourceId !== id
        );

        updateFormData("connections", updatedConnections);
      }

      const updatedBlocks = (formData.leftColumnBlocks || []).filter((block) => block.id !== id);

      updateFormData("leftColumnBlocks", updatedBlocks);
      setTimeout(triggerConnectionsRedraw, 100);
    },
    [formData.leftColumnBlocks, formData.connections, updateFormData, triggerConnectionsRedraw]
  );

  const handleLeftDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const blocks = [...(formData.leftColumnBlocks || [])];
        const oldIndex = blocks.findIndex((block) => block.id === active.id);
        const newIndex = blocks.findIndex((block) => block.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);

          updateFormData("leftColumnBlocks", reorderedBlocks);
          setTimeout(() => triggerConnectionsRedraw(), 50);
        }
      }
    },
    [formData.leftColumnBlocks, updateFormData, triggerConnectionsRedraw]
  );

  const handleAddRightBlock = useCallback(() => {
    const newBlock: DragBlock = {
      id: `right-${Date.now()}`,
      content: ""
    };

    updateFormData("rightColumnBlocks", [...(formData.rightColumnBlocks || []), newBlock]);
  }, [formData.rightColumnBlocks, updateFormData]);

  const handleUpdateRightBlock = useCallback(
    (id: string, content: string) => {
      const updatedBlocks = (formData.rightColumnBlocks || []).map((block) =>
        block.id === id ? { ...block, content } : block
      );

      updateFormData("rightColumnBlocks", updatedBlocks);
    },
    [formData.rightColumnBlocks, updateFormData]
  );

  const handleRemoveRightBlock = useCallback(
    (id: string) => {
      const hasConnections = (formData.connections || []).some((conn) => conn.targetId === id);

      if (hasConnections) {
        const updatedConnections = (formData.connections || []).filter(
          (conn) => conn.targetId !== id
        );

        updateFormData("connections", updatedConnections);
      }

      const updatedBlocks = (formData.rightColumnBlocks || []).filter((block) => block.id !== id);

      updateFormData("rightColumnBlocks", updatedBlocks);
      setTimeout(triggerConnectionsRedraw, 100);
    },
    [formData.rightColumnBlocks, formData.connections, updateFormData, triggerConnectionsRedraw]
  );

  const handleRightDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const blocks = [...(formData.rightColumnBlocks || [])];
        const oldIndex = blocks.findIndex((block) => block.id === active.id);
        const newIndex = blocks.findIndex((block) => block.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);

          updateFormData("rightColumnBlocks", reorderedBlocks);
          setTimeout(() => triggerConnectionsRedraw(), 50);
        }
      }
    },
    [formData.rightColumnBlocks, updateFormData, triggerConnectionsRedraw]
  );

  const renderActiveLine = useCallback(() => {
    if (!activeSource || !hasMovedEnough) return null;

    const sourcePosition = getBlockPosition(activeSource, true);

    if (!sourcePosition) return null;

    return (
      <path
        d={generatePath(sourcePosition, mousePosition)}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="5,5"
        fill="none"
      />
    );
  }, [activeSource, hasMovedEnough, getBlockPosition, generatePath, mousePosition]);

  const renderConnections = useCallback(() => {
    return (formData.connections || []).map((connection) => {
      const sourcePosition = getBlockPosition(connection.sourceId, true);
      const targetPosition = getBlockPosition(connection.targetId, false);

      if (!sourcePosition || !targetPosition) return null;

      const path = generatePath(sourcePosition, targetPosition);
      const color = "#10b981"; // Green color for connections

      const midX = (sourcePosition.x + targetPosition.x) / 2;
      const midY = (sourcePosition.y + targetPosition.y) / 2;

      return (
        <g key={connection.id} className={styles.connection}>
          <path d={path} stroke={color} strokeWidth={2} fill="none" />
          <g
            className={styles.deleteConnection}
            onClick={() => handleDeleteConnection(connection.id)}
          >
            <rect x={midX - 12} y={midY - 12} width={24} height={24} fill="transparent" />
            <circle cx={midX} cy={midY} r="8" className={styles.deleteCircle} stroke={color} />
            <line
              x1={midX - 3}
              y1={midY - 3}
              x2={midX + 3}
              y2={midY + 3}
              stroke={color}
              className={styles.deleteLine}
            />
            <line
              x1={midX + 3}
              y1={midY - 3}
              x2={midX - 3}
              y2={midY + 3}
              stroke={color}
              className={styles.deleteLine}
            />
          </g>
        </g>
      );
    });
  }, [formData.connections, getBlockPosition, generatePath, handleDeleteConnection]);

  useEffect(() => {
    if (activeStep === 1) {
      triggerConnectionsRedraw();
    }
  }, [activeStep, triggerConnectionsRedraw]);

  useEffect(() => {
    if (activeStep === 1 && containerRef.current) {
      const updateSvgHeight = () => {
        const columnsContent = containerRef.current?.querySelector(`.${styles.columnsContent}`);

        if (!columnsContent) return;

        const contentHeight = columnsContent.scrollHeight || 0;

        setSvgHeight(contentHeight);
      };

      updateSvgHeight();

      const resizeObserver = new ResizeObserver(() => {
        updateSvgHeight();
        triggerConnectionsRedraw();
      });

      const columnsContent = containerRef.current.querySelector(`.${styles.columnsContent}`);

      if (columnsContent) {
        resizeObserver.observe(columnsContent);

        // Add scroll event listener
        columnsContent.addEventListener("scroll", triggerConnectionsRedraw);
      }

      return () => {
        resizeObserver.disconnect();
        if (columnsContent) {
          columnsContent.removeEventListener("scroll", triggerConnectionsRedraw);
        }
      };
    }
  }, [activeStep, triggerConnectionsRedraw, formData.leftColumnBlocks, formData.rightColumnBlocks]);

  const renderContentStep = () => {
    const totalConnections = formData.connections?.length || 0;
    const totalLeftBlocks = formData.leftColumnBlocks?.length || 0;
    const totalRightBlocks = formData.rightColumnBlocks?.length || 0;
    const totalPossibleConnections = Math.min(totalLeftBlocks, totalRightBlocks);
    const connectionPercentage =
      totalPossibleConnections > 0
        ? Math.round((totalConnections / totalPossibleConnections) * 100)
        : 0;

    return (
      <div className={styles.contentStep} ref={containerRef} style={{ padding: 0 }}>
        <div className={styles.stepHeader}>
          <div>
            <p>
              Create blocks in both columns and connect them by dragging from the arrow icon on
              source items to their matching targets. Each item can have only one connection.
            </p>
          </div>
          <div className={styles.connectionStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Connections:</span>
              <span className={styles.statValue}>
                {totalConnections} / {totalPossibleConnections}
              </span>
            </div>
            <div
              className={`${styles.connectionProgress} ${connectionPercentage === 100 ? styles.complete : ""}`}
            >
              <div
                className={styles.progressBar}
                style={{ width: `${connectionPercentage}%` }}
                title={`${connectionPercentage}% connected`}
              />
            </div>
          </div>
        </div>

        <div className={styles.columnsContainer}>
          <div className={styles.columnsContent}>
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3>Source Items</h3>
                <Button
                  icon="fa-solid fa-plus"
                  text
                  onClick={handleAddLeftBlock}
                  aria-label="Add source item"
                  className={styles.iconButton}
                />
              </div>
              <div className={styles.blocksContainer}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleLeftDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <SortableContext
                    items={(formData.leftColumnBlocks || []).map((block) => block.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(formData.leftColumnBlocks || []).map((block, index) => (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        onUpdate={handleUpdateLeftBlock}
                        onRemove={handleRemoveLeftBlock}
                        canRemove={(formData.leftColumnBlocks || []).length > 1}
                        isLeft={true}
                        onStartConnection={handleStartConnection}
                        activeSource={activeSource}
                        connections={formData.connections}
                        index={index}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3>Target Matches</h3>
                <Button
                  icon="fa-solid fa-plus"
                  text
                  onClick={handleAddRightBlock}
                  aria-label="Add target match"
                  className={styles.iconButton}
                />
              </div>
              <div className={styles.blocksContainer}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleRightDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <SortableContext
                    items={(formData.rightColumnBlocks || []).map((block) => block.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(formData.rightColumnBlocks || []).map((block, index) => (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        onUpdate={handleUpdateRightBlock}
                        onRemove={handleRemoveRightBlock}
                        canRemove={(formData.rightColumnBlocks || []).length > 1}
                        isLeft={false}
                        isRightTarget={activeSource !== null}
                        onCompleteConnection={handleCompleteConnection}
                        activeSource={activeSource}
                        connections={formData.connections}
                        index={index}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <svg
              ref={svgRef}
              className={styles.connectionsSvg}
              width="100%"
              height="100%"
              key={`connections-svg-${forceRedraw}`}
              preserveAspectRatio="none"
            >
              {renderConnections()}
              {renderActiveLine()}
            </svg>
          </div>

          {activeSource && (
            <div className={styles.connectionGuide}>
              <div className={styles.guideContent}>
                <i className="fa-solid fa-info-circle mr-2" />
                Drag to a target match to create a connection
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <DragAndDropInstructions
            instructions={formData.statement || ""}
            onChange={handleQuestionChange}
          />
        );
      case 1:
        return renderContentStep();
      case 2:
        return (
          <DragAndDropSettings initialData={formData} onSettingsChange={handleSettingsChange} />
        );
      case 3:
        return (
          <DragAndDropPreview
            leftColumnBlocks={formData.leftColumnBlocks || []}
            rightColumnBlocks={formData.rightColumnBlocks || []}
            name={formData.name || ""}
            connections={formData.connections || []}
            statement={formData.statement || ""}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Drag and Drop Exercise"
      exerciseType="dragndrop"
      isEdit={isEdit}
      steps={DRAG_AND_DROP_STEPS}
      activeStep={activeStep}
      isCurrentStepValid={isCurrentStepValid}
      isSaving={isSaving}
      stepsValidity={stepsValidity}
      onCancel={onCancel}
      onBack={goToPrevStep}
      onNext={handleNext}
      onSave={handleSave}
      onStepSelect={handleStepSelect}
      validation={validation}
    >
      <Toast ref={toastRef} />
      {renderStepContent()}
    </ExerciseLayout>
  );
};
