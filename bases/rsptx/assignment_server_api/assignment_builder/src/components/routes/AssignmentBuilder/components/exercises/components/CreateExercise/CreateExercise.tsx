import { exerciseTypes } from "@components/routes/AssignmentBuilder/components/exercises/components/exerciseTypes";
import { useCreateNewExerciseMutation } from "@store/exercises/exercises.logic.api";
import { Button } from "primereact/button";
import { Chips } from "primereact/chips";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { useForm, Controller } from "react-hook-form";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { FormData } from "@/types/createExerciseForm";
import { ExerciseType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";

import { CreateExerciseView } from "./CreateExerciseView";

export const CreateExercise = ({ onExerciseAdd }: { onExerciseAdd: VoidFunction }) => {
  const [createNewExercise] = useCreateNewExerciseMutation();
  const { chapters } = useExercisesSelector();

  const getDefaultValues = () => ({
    exerciseType: exerciseTypes[0],
    points: 1,
    exerciseName: createExerciseId(),
    chapter: chapters && chapters[0],
    author: "",
    difficulty: 3,
    topic: "",
    tags: [],
    questionPrompt: "",
    allowAttachments: false,
    choices: [
      { text: "", feedback: "", correct: false },
      { text: "", feedback: "", correct: false }
    ],
    language: { key: "python", label: "Python (in browser)" },
    instructions: "",
    hiddenPrefixCode: "",
    starterCode: "",
    hiddenSuffixCode: ""
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    defaultValues: getDefaultValues()
  });

  const exerciseType = watch("exerciseType");

  const onSubmit = async (data: FormData) => {
    const response = await createNewExercise({
      author: data.author,
      autograde: null,
      chapter: data.chapter.key,
      difficulty: data.difficulty,
      htmlsrc: "",
      name: data.exerciseName,
      question_json: JSON.stringify({
        ...(data.exerciseType.key === "activecode" && {
          prefix_code: data.hiddenPrefixCode,
          starter_code: data.starterCode,
          suffix_code: data.hiddenSuffixCode,
          instructions: data.instructions,
          language: data.language.key
        }),
        ...(data.exerciseType.key === "shortanswer" && {
          attachment: data.allowAttachments,
          statement: data.questionPrompt
        }),
        ...(data.exerciseType.key === "mchoice" && {
          statement: data.questionPrompt,
          optionList: data.choices.map(({ text, feedback, correct }) => ({
            choice: text,
            feedback,
            correct
          }))
        })
      }),
      question_type: data.exerciseType.key as ExerciseType,
      source: "This question was written in the web interface",
      tags: data.tags.join(),
      topic: data.topic,
      points: data.points
    });

    if (response.data) {
      reset(getDefaultValues());
      onExerciseAdd();
    }
  };

  return (
    <form
      style={{ height: "75vh" }}
      onSubmit={handleSubmit(onSubmit)}
      className="p-fluid formgrid grid align-content-between pb-2"
    >
      <div className="p-fluid formgrid grid">
        {/* Exercise Type */}
        <div className="field col-12 md:col-3 pt-4 ">
          <span className="p-float-label">
            <Controller
              name="exerciseType"
              control={control}
              rules={{ required: "Exercise type is required" }}
              render={({ field }) => (
                <Dropdown
                  id={field.name}
                  {...field}
                  options={exerciseTypes}
                  placeholder=" "
                  optionLabel="label"
                  className={errors.exerciseType ? "p-invalid" : ""}
                />
              )}
            />
            <label htmlFor="exerciseType">Exercise Type</label>
          </span>
          {errors.exerciseType && <small className="p-error">{errors.exerciseType.message}</small>}
        </div>

        {/* Exercise Name */}
        <div className="field col-12 md:col-3  pt-4">
          <span className="p-float-label">
            <Controller
              name="exerciseName"
              control={control}
              rules={{ required: "Exercise name is required" }}
              render={({ field }) => (
                <InputText
                  id="exerciseName"
                  {...field}
                  placeholder=" "
                  className={errors.exerciseName ? "p-invalid" : ""}
                />
              )}
            />
            <label htmlFor="exerciseName">Exercise Name</label>
          </span>
          {errors.exerciseName && <small className="p-error">{errors.exerciseName.message}</small>}
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
              render={({ field }) => <Chips id="tags" {...field} placeholder=" " />}
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
          mode={exerciseType.key as ExerciseType}
          control={control}
          errors={errors}
          watch={watch}
          setValue={setValue}
        />
      </div>

      {/* Submit Button */}
      <div className="mt-auto col-4 md:col-2 md:col-offset-10">
        <Button type="submit" label="Submit" className="mt-2" />
      </div>
    </form>
  );
};
