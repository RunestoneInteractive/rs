import { configureStore } from "@reduxjs/toolkit";
import { datasetSlice, datasetActions, datasetSelectors, DatasetState } from "./dataset.logic";
import { TableDropdownOption, SectionOption } from "@/types/dataset";

function makeStore(preloadedDataset?: Partial<DatasetState>) {
  return configureStore({
    reducer: { dataset: datasetSlice.reducer },
    preloadedState: preloadedDataset
      ? { dataset: { ...buildInitial(), ...preloadedDataset } }
      : undefined
  });
}

function buildInitial(): DatasetState {
  return {
    whichToGradeOptions: [],
    autoGradeOptions: [],
    languageOptions: [],
    questionTypeOptions: [],
    sections: []
  };
}

const sampleDropdownOptions: TableDropdownOption[] = [
  { value: "first_answer", label: "First Answer", description: "Grade the first answer" },
  { value: "last_answer", label: "Last Answer", description: "Grade the last answer" }
];

const sampleSections: SectionOption[] = [
  { title: "ch01", label: "Chapter 1" },
  { title: "ch02", label: "Chapter 2" }
];

describe("datasetSlice reducer", () => {
  it("returns the initial state when no action is dispatched", () => {
    const store = makeStore();
    expect(store.getState().dataset).toEqual(buildInitial());
  });

  it("setWhichToGradeOptions replaces the whichToGradeOptions array", () => {
    const store = makeStore();
    store.dispatch(datasetActions.setWhichToGradeOptions(sampleDropdownOptions));
    expect(store.getState().dataset.whichToGradeOptions).toEqual(sampleDropdownOptions);
  });

  it("setWhichToGradeOptions with an empty array clears previous options", () => {
    const store = makeStore({ whichToGradeOptions: sampleDropdownOptions });
    store.dispatch(datasetActions.setWhichToGradeOptions([]));
    expect(store.getState().dataset.whichToGradeOptions).toEqual([]);
  });

  it("setAutoGradeOptions replaces the autoGradeOptions array", () => {
    const store = makeStore();
    store.dispatch(datasetActions.setAutoGradeOptions(sampleDropdownOptions));
    expect(store.getState().dataset.autoGradeOptions).toEqual(sampleDropdownOptions);
  });

  it("setAutoGradeOptions with an empty array clears previous options", () => {
    const store = makeStore({ autoGradeOptions: sampleDropdownOptions });
    store.dispatch(datasetActions.setAutoGradeOptions([]));
    expect(store.getState().dataset.autoGradeOptions).toEqual([]);
  });

  it("setLanguageOptions replaces the languageOptions array", () => {
    const store = makeStore();
    const langOptions: TableDropdownOption[] = [
      { value: "python", label: "Python", description: "Python language" }
    ];
    store.dispatch(datasetActions.setLanguageOptions(langOptions));
    expect(store.getState().dataset.languageOptions).toEqual(langOptions);
  });

  it("setLanguageOptions does not affect other state fields", () => {
    const store = makeStore({ autoGradeOptions: sampleDropdownOptions });
    store.dispatch(
      datasetActions.setLanguageOptions([{ value: "java", label: "Java", description: "" }])
    );
    expect(store.getState().dataset.autoGradeOptions).toEqual(sampleDropdownOptions);
  });

  it("setQuestionTypeOptions replaces the questionTypeOptions array", () => {
    const store = makeStore();
    const typeOptions: TableDropdownOption[] = [
      { value: "mchoice", label: "Multiple Choice", description: "MC question" }
    ];
    store.dispatch(datasetActions.setQuestionTypeOptions(typeOptions));
    expect(store.getState().dataset.questionTypeOptions).toEqual(typeOptions);
  });

  it("setQuestionTypeOptions with an empty array clears previous options", () => {
    const store = makeStore({ questionTypeOptions: sampleDropdownOptions });
    store.dispatch(datasetActions.setQuestionTypeOptions([]));
    expect(store.getState().dataset.questionTypeOptions).toEqual([]);
  });

  it("setSections replaces the sections array", () => {
    const store = makeStore();
    store.dispatch(datasetActions.setSections(sampleSections));
    expect(store.getState().dataset.sections).toEqual(sampleSections);
  });

  it("setSections with an empty array clears previous sections", () => {
    const store = makeStore({ sections: sampleSections });
    store.dispatch(datasetActions.setSections([]));
    expect(store.getState().dataset.sections).toEqual([]);
  });

  it("dispatching one action does not mutate sibling fields", () => {
    const store = makeStore({
      whichToGradeOptions: sampleDropdownOptions,
      sections: sampleSections
    });
    store.dispatch(
      datasetActions.setAutoGradeOptions([{ value: "x", label: "X", description: "" }])
    );
    const state = store.getState().dataset;
    expect(state.whichToGradeOptions).toEqual(sampleDropdownOptions);
    expect(state.sections).toEqual(sampleSections);
    expect(state.languageOptions).toEqual([]);
    expect(state.questionTypeOptions).toEqual([]);
  });
});

describe("datasetSelectors", () => {
  it("getWhichToGradeOptions returns the whichToGradeOptions from state", () => {
    const fakeState = {
      dataset: { ...buildInitial(), whichToGradeOptions: sampleDropdownOptions }
    } as any;
    expect(datasetSelectors.getWhichToGradeOptions(fakeState)).toEqual(sampleDropdownOptions);
  });

  it("getAutoGradeOptions returns the autoGradeOptions from state", () => {
    const fakeState = {
      dataset: { ...buildInitial(), autoGradeOptions: sampleDropdownOptions }
    } as any;
    expect(datasetSelectors.getAutoGradeOptions(fakeState)).toEqual(sampleDropdownOptions);
  });

  it("getLanguageOptions returns the languageOptions from state", () => {
    const opts: TableDropdownOption[] = [{ value: "sql", label: "SQL", description: "" }];
    const fakeState = { dataset: { ...buildInitial(), languageOptions: opts } } as any;
    expect(datasetSelectors.getLanguageOptions(fakeState)).toEqual(opts);
  });

  it("getQuestionTypeOptions returns the questionTypeOptions from state", () => {
    const opts: TableDropdownOption[] = [
      { value: "fitb", label: "Fill in the Blank", description: "" }
    ];
    const fakeState = { dataset: { ...buildInitial(), questionTypeOptions: opts } } as any;
    expect(datasetSelectors.getQuestionTypeOptions(fakeState)).toEqual(opts);
  });

  it("getSections returns the sections from state", () => {
    const fakeState = { dataset: { ...buildInitial(), sections: sampleSections } } as any;
    expect(datasetSelectors.getSections(fakeState)).toEqual(sampleSections);
  });

  it("selectors return empty arrays when state is at initial values", () => {
    const fakeState = { dataset: buildInitial() } as any;
    expect(datasetSelectors.getWhichToGradeOptions(fakeState)).toEqual([]);
    expect(datasetSelectors.getAutoGradeOptions(fakeState)).toEqual([]);
    expect(datasetSelectors.getLanguageOptions(fakeState)).toEqual([]);
    expect(datasetSelectors.getQuestionTypeOptions(fakeState)).toEqual([]);
    expect(datasetSelectors.getSections(fakeState)).toEqual([]);
  });
});
