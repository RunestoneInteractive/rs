export type TableDropdownOption = {
  value: string;
  label: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supported_question_types?: any;
};

export type SectionOption = {
  title: string;
  label: string;
};

export type SectionsResponse = {
  sections: SectionOption[];
};
