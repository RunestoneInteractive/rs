import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Controller } from "react-hook-form";

import { CreateExerciseFormProps } from "@/types/createExerciseForm";

export const CreateActiveCodeExercise = ({ control, errors }: CreateExerciseFormProps) => {
  const languageOptions = [
    { key: "python", label: "Python (in browser)" },
    { key: "java", label: "Java" },
    { key: "cpp", label: "C++" },
    { key: "c", label: "C" },
    { key: "javascript", label: "Javascript" },
    { key: "html", label: "HTML" },
    { key: "sql", label: "SQL" }
  ];

  return (
    <>
      {/* Language */}
      <div className="field col-12 md:col-3 pt-4 ">
        <span className="p-float-label">
          <Controller
            name="language"
            control={control}
            rules={{ required: "Language is required" }}
            render={({ field }) => (
              <Dropdown
                id={field.name}
                {...field}
                options={languageOptions}
                placeholder=" "
                optionLabel="label"
                className={errors.language ? "p-invalid" : ""}
              />
            )}
          />
          <label htmlFor="language">Language</label>
        </span>
        {errors.language && <small className="p-error">{errors.language.message}</small>}
      </div>
      <div className="field col-12 md:col-9 pt-4 " />
      <div className="field col-12 md:col-6 pt-4">
        <span className="p-float-label">
          <Controller
            name="instructions"
            control={control}
            rules={{ required: "Instructions are required" }}
            render={({ field, fieldState }) => (
              <>
                <InputTextarea
                  id="instructions"
                  {...field}
                  autoResize
                  rows={4}
                  placeholder="Enter Assignment instructions(HTML allowed)"
                  className={fieldState.invalid ? "p-invalid" : ""}
                />
                <label htmlFor="instructions">Instructions</label>
              </>
            )}
          />
        </span>
        {errors.instructions && <small className="p-error">{errors.instructions.message}</small>}
      </div>

      <div className="field col-12 md:col-6 pt-4">
        <span className="p-float-label">
          <Controller
            name="hiddenPrefixCode"
            control={control}
            rules={{ required: "Hidden Prefix Code is required" }}
            render={({ field, fieldState }) => (
              <>
                <InputTextarea
                  id="hiddenPrefixCode"
                  {...field}
                  autoResize
                  rows={4}
                  placeholder="Enter Assignment prefix code"
                  className={fieldState.invalid ? "p-invalid" : ""}
                />
                <label htmlFor="hiddenPrefixCode">Hidden Prefix Code</label>
              </>
            )}
          />
        </span>
        {errors.hiddenPrefixCode && (
          <small className="p-error">{errors.hiddenPrefixCode.message}</small>
        )}
      </div>

      <div className="field col-12 md:col-6 pt-4">
        <span className="p-float-label">
          <Controller
            name="starterCode"
            control={control}
            rules={{ required: "Starter Code is required" }}
            render={({ field, fieldState }) => (
              <>
                <InputTextarea
                  id="starterCode"
                  {...field}
                  autoResize
                  rows={4}
                  placeholder="Enter Assignment starter code"
                  className={fieldState.invalid ? "p-invalid" : ""}
                />
                <label htmlFor="starterCode">Starter Code</label>
              </>
            )}
          />
        </span>
        {errors.starterCode && <small className="p-error">{errors.starterCode.message}</small>}
      </div>

      <div className="field col-12 md:col-6 pt-4">
        <span className="p-float-label">
          <Controller
            name="hiddenSuffixCode"
            control={control}
            rules={{ required: "Hidden Suffix Code is required" }}
            render={({ field, fieldState }) => (
              <>
                <InputTextarea
                  id="hiddenSuffixCode"
                  {...field}
                  autoResize
                  rows={4}
                  placeholder="Enter Assignment suffix(unit test) code"
                  className={fieldState.invalid ? "p-invalid" : ""}
                />
                <label htmlFor="hiddenSuffixCode">Hidden Suffix(Test) Code</label>
              </>
            )}
          />
        </span>
        {errors.hiddenSuffixCode && (
          <small className="p-error">{errors.hiddenSuffixCode.message}</small>
        )}
      </div>
    </>
  );
};
