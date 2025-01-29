import { datasetSelectors } from "@store/dataset/dataset.logic";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Controller } from "react-hook-form";
import { useSelector } from "react-redux";

import { CreateExerciseFormProps } from "@/types/createExerciseForm";

export const CreateActiveCodeExercise = ({ control, errors }: CreateExerciseFormProps) => {
  const languageOptions = useSelector(datasetSelectors.getLanguageOptions);

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
            name="prefix_code"
            control={control}
            rules={{ required: "Hidden Prefix Code is required" }}
            render={({ field, fieldState }) => (
              <>
                <InputTextarea
                  id="prefix_code"
                  {...field}
                  autoResize
                  rows={4}
                  placeholder="Enter Assignment prefix code"
                  className={fieldState.invalid ? "p-invalid" : ""}
                />
                <label htmlFor="prefix_code">Hidden Prefix Code</label>
              </>
            )}
          />
        </span>
        {errors.prefix_code && <small className="p-error">{errors.prefix_code.message}</small>}
      </div>

      <div className="field col-12 md:col-6 pt-4">
        <span className="p-float-label">
          <Controller
            name="starter_code"
            control={control}
            rules={{ required: "Starter Code is required" }}
            render={({ field, fieldState }) => (
              <>
                <InputTextarea
                  id="starter_code"
                  {...field}
                  autoResize
                  rows={4}
                  placeholder="Enter Assignment starter code"
                  className={fieldState.invalid ? "p-invalid" : ""}
                />
                <label htmlFor="starter_code">Starter Code</label>
              </>
            )}
          />
        </span>
        {errors.starter_code && <small className="p-error">{errors.starter_code.message}</small>}
      </div>

      <div className="field col-12 md:col-6 pt-4">
        <span className="p-float-label">
          <Controller
            name="suffix_code"
            control={control}
            rules={{ required: "Hidden Suffix Code is required" }}
            render={({ field, fieldState }) => (
              <>
                <InputTextarea
                  id="suffix_code"
                  {...field}
                  autoResize
                  rows={4}
                  placeholder="Enter Assignment suffix(unit test) code"
                  className={fieldState.invalid ? "p-invalid" : ""}
                />
                <label htmlFor="suffix_code">Hidden Suffix(Test) Code</label>
              </>
            )}
          />
        </span>
        {errors.suffix_code && <small className="p-error">{errors.suffix_code.message}</small>}
      </div>
    </>
  );
};
