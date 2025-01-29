import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";
import { Controller } from "react-hook-form";

import { CreateExerciseFormProps } from "@/types/createExerciseForm";

export const CreateShortAnswerExercise = ({
  control,
  errors,
  setValue
}: CreateExerciseFormProps) => {
  console.log("CreateShortAnswerExercise");
  return (
    <>
      {/* Question Prompt */}
      <div className="field col-12 md:col-9 pt-4">
        <span className="p-float-label">
          <Controller
            name="statement"
            control={control}
            rules={{
              required: "Question prompt is required",
              minLength: { value: 1, message: "Minimum 1 symbol required" },
              maxLength: { value: 10000, message: "Maximum 10000 symbols allowed" }
            }}
            render={({ field }) => (
              <InputTextarea
                id="statement"
                {...field}
                rows={3}
                autoResize
                maxLength={10000}
                placeholder=" "
                className={errors.statement ? "p-invalid" : ""}
              />
            )}
          />
          <label htmlFor="statement">Question Prompt</label>
        </span>
        {errors.statement && <small className="p-error">{errors.statement.message}</small>}
      </div>

      {/* Allow Attachments */}
      <div className="field col-12 md:col-3 pt-4">
        <Controller
          name="attachment"
          control={control}
          render={({ field }) => (
            <div className="flex align-items-center flex-shrink-1 gap-1">
              <InputSwitch
                id="attachment"
                checked={field.value ?? false}
                onChange={(e) => setValue("attachment", e.value)}
              />
              <label htmlFor="attachment" className="p-ml-2">
                Allow Attachments
              </label>
            </div>
          )}
        />
      </div>
    </>
  );
};
