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
import { UnstyledButton } from "@mantine/core";
import { FC, useCallback, useMemo, useRef, useState, useEffect } from "react";

import { Icon } from "@/components/ui/Icon";
import { QuestionJSON } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { safeJsonParse } from "@/utils/json";
import { generateMatchingPreview } from "@/utils/preview/matchingPreview";
import { DEFAULT_INCORRECT_FEEDBACK, buildQuestionJson } from "@/utils/questionJson";

import { MATCHING_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import {
  ConnectionList,
  blockSide,
  connectionExistsBetween,
  makeConnectionLabelResolver
} from "../../shared/connections";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { ExerciseComponentProps } from "../../types/ExerciseTypes";
import { validateCommonFields } from "../../utils/validation";

import styles from "./MatchingExercise.module.css";
import { MatchingPreview } from "./MatchingPreview";
import { MatchingSettings } from "./MatchingSettings";
import { MatchingInstructions, SortableBlock } from "./components";
import { useMatchingConnections } from "./hooks";
import { MatchingData, ItemWithLabel } from "./types";

const MATCHING_STEPS = [
  { label: "Statement" },
  { label: "Content" },
  { label: "Settings" },
  { label: "Preview" }
];

const getDefaultFormData = (): MatchingData => ({
  name: createExerciseId(),
  author: "",
  topic: "",
  chapter: "",
  subchapter: "",
  tags: "",
  points: 1,
  difficulty: 3,
  htmlsrc: "",
  question_type: "matching",
  statement: "",
  left: [{ id: `left-${Date.now()}`, label: "" }],
  right: [{ id: `right-${Date.now() + 1}`, label: "" }],
  correctAnswers: [],
  feedback: DEFAULT_INCORRECT_FEEDBACK
});

export const MatchingExercise: FC<ExerciseComponentProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setSvgHeight] = useState<number>(0);

  const parsedInitialData = useMemo(() => {
    if (isEdit && initialData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const initialWithJson = initialData as any;
      const questionJson = safeJsonParse<QuestionJSON>(initialWithJson.question_json || "{}") || {};

      return {
        ...initialData,
        left: questionJson.left || getDefaultFormData().left,
        right: questionJson.right || getDefaultFormData().right,
        correctAnswers: questionJson.correctAnswers || getDefaultFormData().correctAnswers,
        feedback: questionJson.feedback || getDefaultFormData().feedback
      } as MatchingData;
    }

    return initialData as MatchingData;
  }, [initialData, isEdit]);

  const handleMatchingSave = useCallback(
    async (data: MatchingData) => {
      const htmlsrc = generateMatchingPreview({
        left: data.left || [],
        right: data.right || [],
        correctAnswers: data.correctAnswers || [],
        feedback: data.feedback || DEFAULT_INCORRECT_FEEDBACK,
        name: data.name || "",
        statement: data.statement || ""
      });

      const augmentedData = {
        ...data,
        htmlsrc,
        question_json: buildQuestionJson({
          ...data,
          question_type: "matching"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onSave(augmentedData as any);
    },
    [onSave]
  );

  const {
    formData,
    activeStep,
    isSaving,
    isDirty,
    updateFormData,
    handleSettingsChange,
    handleQuestionChange,
    isCurrentStepValid,
    goToNextStep,
    goToPrevStep,
    handleSave: baseHandleSave,
    setActiveStep
  } = useBaseExercise<MatchingData>({
    initialData: parsedInitialData,
    steps: MATCHING_STEPS,
    exerciseType: "matching",
    generatePreview: (data) =>
      generateMatchingPreview({
        left: data.left || [],
        right: data.right || [],
        correctAnswers: data.correctAnswers || [],
        feedback: data.feedback || DEFAULT_INCORRECT_FEEDBACK,
        name: data.name || "",
        statement: data.statement || ""
      }),
    validateStep: (step, data) => {
      const errors = MATCHING_STEP_VALIDATORS[step](data);

      return errors.length === 0;
    },
    validateForm: validateCommonFields,
    getDefaultFormData,
    onSave: handleMatchingSave,
    onCancel,
    resetForm,
    onFormReset,
    isEdit
  });

  const { validation, handleNext, handleStepSelect, handleSave, stepsValidity } =
    useExerciseStepNavigation({
      data: formData,
      activeStep,
      setActiveStep,
      stepValidators: MATCHING_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: MATCHING_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: (data) =>
        generateMatchingPreview({
          left: data.left || [],
          right: data.right || [],
          correctAnswers: data.correctAnswers || [],
          feedback: data.feedback || DEFAULT_INCORRECT_FEEDBACK,
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
    cancelConnection,
    handleDeleteConnection,
    getBlockPosition,
    generatePath,
    hasMovedEnough,
    mousePosition
  } = useMatchingConnections({
    formData,
    updateFormData,
    containerRef
  });

  const handleAddLeftBlock = useCallback(() => {
    const newItem: ItemWithLabel = {
      id: `left-${Date.now()}`,
      label: ""
    };

    updateFormData("left", [...(formData.left || []), newItem]);
  }, [formData.left, updateFormData]);

  const handleUpdateLeftBlock = useCallback(
    (id: string, content: string) => {
      const updatedItems = (formData.left || []).map((item) =>
        item.id === id ? { ...item, label: content } : item
      );

      updateFormData("left", updatedItems);
    },
    [formData.left, updateFormData]
  );

  const handleRemoveLeftBlock = useCallback(
    (id: string) => {
      const hasConnections = (formData.correctAnswers || []).some(([sourceId]) => sourceId === id);

      if (hasConnections) {
        const updatedConnections = (formData.correctAnswers || []).filter(
          ([sourceId]) => sourceId !== id
        );

        updateFormData("correctAnswers", updatedConnections);
      }

      const updatedItems = (formData.left || []).filter((item) => item.id !== id);

      updateFormData("left", updatedItems);
      setTimeout(triggerConnectionsRedraw, 100);
    },
    [formData.left, formData.correctAnswers, updateFormData, triggerConnectionsRedraw]
  );

  const handleLeftDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const items = [...(formData.left || [])];
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        updateFormData("left", arrayMove(items, oldIndex, newIndex));
        setTimeout(triggerConnectionsRedraw, 100);
      }
    },
    [formData.left, updateFormData, triggerConnectionsRedraw]
  );

  const handleAddRightBlock = useCallback(() => {
    const newItem: ItemWithLabel = {
      id: `right-${Date.now()}`,
      label: ""
    };

    updateFormData("right", [...(formData.right || []), newItem]);
  }, [formData.right, updateFormData]);

  const handleUpdateRightBlock = useCallback(
    (id: string, content: string) => {
      const updatedItems = (formData.right || []).map((item) =>
        item.id === id ? { ...item, label: content } : item
      );

      updateFormData("right", updatedItems);
    },
    [formData.right, updateFormData]
  );

  const handleRemoveRightBlock = useCallback(
    (id: string) => {
      const hasConnections = (formData.correctAnswers || []).some(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ([_, targetId]) => targetId === id
      );

      if (hasConnections) {
        const updatedConnections = (formData.correctAnswers || []).filter(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ([_, targetId]) => targetId !== id
        );

        updateFormData("correctAnswers", updatedConnections);
      }

      const updatedItems = (formData.right || []).filter((item) => item.id !== id);

      updateFormData("right", updatedItems);
      setTimeout(triggerConnectionsRedraw, 100);
    },
    [formData.right, formData.correctAnswers, updateFormData, triggerConnectionsRedraw]
  );

  const handleRightDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const items = [...(formData.right || [])];
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        updateFormData("right", arrayMove(items, oldIndex, newIndex));
        setTimeout(triggerConnectionsRedraw, 100);
      }
    },
    [formData.right, updateFormData, triggerConnectionsRedraw]
  );

  const renderConnections = useCallback(() => {
    return (formData.correctAnswers || []).map(([leftId, rightId]) => {
      const sourcePosition = getBlockPosition(leftId, true);
      const targetPosition = getBlockPosition(rightId, false);

      if (!sourcePosition || !targetPosition) return null;

      const path = generatePath(sourcePosition, targetPosition);
      const midX = (sourcePosition.x + targetPosition.x) / 2;
      const midY = (sourcePosition.y + targetPosition.y) / 2;

      return (
        <g key={`connection-${leftId}-${rightId}`} className={styles.connection}>
          <path d={path} fill="none" strokeWidth="2" className={styles.connectionPath} />
          <g
            className={styles.deleteConnection}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteConnection(leftId, rightId);
            }}
            style={{ cursor: "pointer" }}
          >
            <rect x={midX - 12} y={midY - 12} width={24} height={24} fill="transparent" />
            <circle cx={midX} cy={midY} r="8" className={styles.deleteCircle} />
            <line
              x1={midX - 3}
              y1={midY - 3}
              x2={midX + 3}
              y2={midY + 3}
              className={styles.deleteLine}
              strokeWidth="1.5"
            />
            <line
              x1={midX + 3}
              y1={midY - 3}
              x2={midX - 3}
              y2={midY + 3}
              className={styles.deleteLine}
              strokeWidth="1.5"
            />
          </g>
        </g>
      );
    });
  }, [formData.correctAnswers, getBlockPosition, generatePath, handleDeleteConnection]);

  const renderActiveLine = useCallback(() => {
    if (!activeSource || !hasMovedEnough) return null;

    const isLeftSource = blockSide(formData.left || [], formData.right || [], activeSource) === "left";
    const sourcePosition = getBlockPosition(activeSource, isLeftSource);

    if (!sourcePosition) return null;

    const path = generatePath(sourcePosition, mousePosition);

    return (
      <path
        d={path}
        fill="none"
        strokeWidth="2"
        strokeDasharray="5,5"
        className={styles.activePath}
      />
    );
  }, [activeSource, hasMovedEnough, formData.left, formData.right, getBlockPosition, generatePath, mousePosition]);

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

        columnsContent.addEventListener("scroll", triggerConnectionsRedraw);
      }

      return () => {
        resizeObserver.disconnect();
        if (columnsContent) {
          columnsContent.removeEventListener("scroll", triggerConnectionsRedraw);
        }
      };
    }
  }, [activeStep, triggerConnectionsRedraw, formData.left, formData.right]);

  const isBlockConnectTarget = (blockId: string): boolean => {
    if (!activeSource) return false;

    const left = formData.left || [];
    const right = formData.right || [];
    const sourceSide = blockSide(left, right, activeSource);
    const targetSide = blockSide(left, right, blockId);

    if (sourceSide === targetSide) return false;

    const [leftId, rightId] =
      sourceSide === "left" ? [activeSource, blockId] : [blockId, activeSource];

    return !connectionExistsBetween(formData.correctAnswers || [], leftId, rightId);
  };

  const renderContentStep = () => {
    return (
      <div className={styles.contentStep} ref={containerRef} style={{ padding: 0 }}>
        <div className={styles.columnsContainer}>
          <div className={styles.columnsContent}>
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3>Source items</h3>
              </div>
              <div className={styles.blocksContainer}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleLeftDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <SortableContext
                    items={(formData.left || []).map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(formData.left || []).map((item, index) => (
                      <SortableBlock
                        key={item.id}
                        block={{ id: item.id, content: item.label }}
                        onUpdate={handleUpdateLeftBlock}
                        onRemove={handleRemoveLeftBlock}
                        canRemove={(formData.left || []).length > 1}
                        isLeft={true}
                        onStartConnection={handleStartConnection}
                        onCancelConnection={cancelConnection}
                        isConnectTarget={isBlockConnectTarget(item.id)}
                        onCompleteConnection={handleCompleteConnection}
                        activeSource={activeSource}
                        connections={formData.correctAnswers}
                        index={index}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <UnstyledButton
                  className={styles.addRow}
                  onClick={handleAddLeftBlock}
                  aria-label="Add source item"
                >
                  <Icon name="plus" size={14} />
                  Add source item
                </UnstyledButton>
              </div>
            </div>

            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3>Target matches</h3>
              </div>
              <div className={styles.blocksContainer}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleRightDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <SortableContext
                    items={(formData.right || []).map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(formData.right || []).map((item, index) => (
                      <SortableBlock
                        key={item.id}
                        block={{ id: item.id, content: item.label }}
                        onUpdate={handleUpdateRightBlock}
                        onRemove={handleRemoveRightBlock}
                        canRemove={(formData.right || []).length > 1}
                        isLeft={false}
                        isConnectTarget={isBlockConnectTarget(item.id)}
                        onStartConnection={handleStartConnection}
                        onCancelConnection={cancelConnection}
                        onCompleteConnection={handleCompleteConnection}
                        activeSource={activeSource}
                        connections={formData.correctAnswers}
                        index={index}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <UnstyledButton
                  className={styles.addRow}
                  onClick={handleAddRightBlock}
                  aria-label="Add target match"
                >
                  <Icon name="plus" size={14} />
                  Add target match
                </UnstyledButton>
              </div>
            </div>

            <svg
              ref={svgRef}
              className={styles.connectionsSvg}
              width="100%"
              height="100%"
              key={`connections-svg-${forceRedraw}`}
            >
              {renderConnections()}
              {renderActiveLine()}
            </svg>
          </div>

          {activeSource && (
            <div className={styles.connectionGuide}>
              <div className={styles.guideContent}>
                <Icon name="info-circle" size={14} color="currentColor" />
                Pick{" "}
                {blockSide(formData.left || [], formData.right || [], activeSource) === "left"
                  ? "a target match"
                  : "a source item"}{" "}
                to finish the connection
              </div>
            </div>
          )}
        </div>

        <ConnectionList
          connections={formData.correctAnswers || []}
          resolveLabel={makeConnectionLabelResolver(formData.left || [], formData.right || [])}
          onRemove={handleDeleteConnection}
        />
      </div>
    );
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <MatchingInstructions
            instructions={formData.statement || ""}
            onChange={handleQuestionChange}
          />
        );
      case 1:
        return renderContentStep();
      case 2:
        return <MatchingSettings initialData={formData} onSettingsChange={handleSettingsChange} />;
      case 3:
        return (
          <MatchingPreview
            left={formData.left || []}
            right={formData.right || []}
            correctAnswers={formData.correctAnswers || []}
            feedback={formData.feedback || DEFAULT_INCORRECT_FEEDBACK}
            name={formData.name || ""}
            statement={formData.statement || ""}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="matching exercise"
      exerciseType="matching"
      isEdit={isEdit}
      steps={MATCHING_STEPS}
      activeStep={activeStep}
      onStepSelect={handleStepSelect}
      isCurrentStepValid={isCurrentStepValid}
      stepsValidity={stepsValidity}
      onNext={handleNext}
      onBack={goToPrevStep}
      onCancel={onCancel}
      onSave={handleSave}
      isSaving={isSaving}
      isDirty={isDirty}
      validation={validation}
    >
      {renderStepContent()}
    </ExerciseLayout>
  );
};
