import { datasetSelectors } from "@store/dataset/dataset.logic";
import { Button } from "primereact/button";
import { Chips } from "primereact/chips";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { useForm, Controller } from "react-hook-form";
import { useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { CreateExerciseFormType, ExerciseType, isExerciseType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { getDefaultQuestionJson } from "@/utils/questionJson";

import { CreateExerciseView } from "./CreateExerciseView";

export const CreateExercise = ({
  initialValues,
  onFormSubmit
}: {
  initialValues?: CreateExerciseFormType;
  onFormSubmit: (data: CreateExerciseFormType) => Promise<void>;
}) => {
  const { chapters } = useExercisesSelector();
  const languageOptions = useSelector(datasetSelectors.getLanguageOptions);
  const questionTypeOptions = useSelector(datasetSelectors.getQuestionTypeOptions);

  const getDefaultValues = () => ({
    question_type: questionTypeOptions && questionTypeOptions[0].value,
    points: 1,
    name: createExerciseId(),
    chapter: chapters && chapters[0].value,
    author: "",
    difficulty: 3,
    topic: "",
    tags: "",
    ...getDefaultQuestionJson(languageOptions)
  });

  const defaultValues = initialValues ?? getDefaultValues();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<CreateExerciseFormType>({
    defaultValues
  });

  const exerciseType = watch("question_type");

  const onSubmit = async (data: CreateExerciseFormType) => {
    onFormSubmit(data).then(() => {
      reset(defaultValues);
    });
  };

  return (
    <form
      style={{ height: "75vh" }}
      onSubmit={handleSubmit(onSubmit)}
      className="p-fluid formgrid grid align-content-between pb-2"
    >
      <div className="p-fluid formgrid grid" style={{ width: "100%" }}>
        {/* Exercise Type */}
        <div className="field col-12 md:col-3 pt-4 ">
          <span className="p-float-label">
            <Controller
              name="question_type"
              control={control}
              rules={{ required: "Exercise type is required" }}
              render={({ field }) => (
                <Dropdown
                  id={field.name}
                  {...field}
                  options={questionTypeOptions}
                  placeholder=""
                  optionLabel="label"
                  className={errors.question_type ? "p-invalid" : ""}
                />
              )}
            />
            <label htmlFor="exerciseType">Exercise Type</label>
          </span>
          {errors.question_type && (
            <small className="p-error">{errors.question_type.message}</small>
          )}
        </div>

        {isExerciseType(exerciseType) ? (
          <>
            {/* Exercise Name */}
            <div className="field col-12 md:col-3  pt-4">
              <span className="p-float-label">
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: "Exercise name is required" }}
                  render={({ field }) => (
                    <InputText
                      id={field.name}
                      {...field}
                      placeholder=" "
                      className={errors.name ? "p-invalid" : ""}
                    />
                  )}
                />
                <label htmlFor="exerciseName">Exercise Name</label>
              </span>
              {errors.name && <small className="p-error">{errors.name.message}</small>}
            </div>

            {/* Author */}
            <div className="field col-12 md:col-3  pt-4">
              <span className="p-float-label">
                <Controller
                  name="author"
                  control={control}
                  //rules={{ required: "Author is required" }}
                  render={({ field }) => (
                    <InputText
                      id="author"
                      {...field}
                      placeholder=" "
                      className={errors.author ? "p-invalid" : ""}
                    />
                  )}
                />
                <label htmlFor="author">Author (optional)</label>
              </span>
              {errors.author && <small className="p-error">{errors.author.message}</small>}
            </div>

            {/* Topic */}
            <div className="field col-12 md:col-3  pt-4">
              <span className="p-float-label">
                <Controller
                  name="topic"
                  control={control}
                  // rules={{ required: "Topic is required" }}
                  render={({ field }) => (
                    <InputText
                      id="topic"
                      {...field}
                      placeholder=" "
                      className={errors.topic ? "p-invalid" : ""}
                    />
                  )}
                />
                <label htmlFor="topic">Topic (optional)</label>
              </span>
              {errors.topic && <small className="p-error">{errors.topic.message}</small>}
            </div>

            {/* Chapter */}
            <div className="field col-12 md:col-5  pt-4">
              <span className="p-float-label">
                <Controller
                  name="chapter"
                  control={control}
                  rules={{ required: "Chapter is required" }}
                  render={({ field }) => (
                    <Dropdown
                      id="chapter"
                      {...field}
                      options={chapters}
                      optionLabel="label"
                      placeholder=" "
                      className={errors.chapter ? "p-invalid" : ""}
                    />
                  )}
                />
                <label htmlFor="chapter">Chapter</label>
              </span>
              {errors.chapter && <small className="p-error">{errors.chapter.message}</small>}
            </div>

            {/* Tags */}
            <div className="field col-12 md:col-5  pt-4">
              <span className="p-float-label">
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <Chips
                      id="tags"
                      {...field}
                      value={field.value ? field.value.split(",") : []}
                      onChange={(e) => {
                        field.onChange(e.value?.join(","));
                      }}
                      placeholder=" "
                    />
                  )}
                />
                <label htmlFor="tags">Tags (optional)</label>
              </span>
            </div>

            {/* Points */}
            <div className="field col-6 md:col-1  pt-4">
              <span className="p-float-label">
                <Controller
                  name="points"
                  control={control}
                  rules={{
                    required: "Points are required",
                    min: { value: 0, message: "Minimum is 0" },
                    max: { value: 100000, message: "Maximum is 100000" }
                  }}
                  render={({ field }) => (
                    <InputNumber
                      id="points"
                      {...field}
                      min={0}
                      max={100000}
                      placeholder=" "
                      className={errors.points ? "p-invalid" : ""}
                      value={field.value}
                      onChange={(e) => setValue("points", e.value ?? 0)}
                    />
                  )}
                />
                <label htmlFor="points">Points</label>
              </span>
              {errors.points && <small className="p-error">{errors.points.message}</small>}
            </div>

            {/* Difficulty */}
            <div className="field col-6 md:col-1  pt-4">
              <span className="p-float-label">
                <Controller
                  name="difficulty"
                  control={control}
                  rules={{
                    required: "Difficulty is required",
                    min: { value: 0, message: "Minimum is 0" },
                    max: { value: 100000, message: "Maximum is 100000" }
                  }}
                  render={({ field }) => (
                    <InputNumber
                      id="difficulty"
                      {...field}
                      min={0}
                      max={100000}
                      placeholder=" "
                      className={errors.difficulty ? "p-invalid" : ""}
                      value={field.value ?? 0}
                      onChange={(e) => setValue("difficulty", e.value ?? 0)}
                    />
                  )}
                />
                <label htmlFor="difficulty">Difficulty</label>
              </span>
              {errors.difficulty && <small className="p-error">{errors.difficulty.message}</small>}
            </div>

            <CreateExerciseView
              mode={exerciseType as ExerciseType}
              control={control}
              errors={errors}
              watch={watch}
              setValue={setValue}
            />
          </>
        ) : (
          <div className="field col12 md:col-12 pt-4 flex align-center justify-content-center">
            <h5>Coming soon</h5>
          </div>
        )}
      </div>

      {isExerciseType(exerciseType) && (
        <div className="mt-auto col-4 md:col-2 md:col-offset-10">
          <Button type="submit" label="Submit" className="mt-2" />
        </div>
      )}
    </form>
  );
};
