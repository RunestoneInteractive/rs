export type TableDropdownOption = {
  value: string;
  label: string;
  description: string;
  supported_question_types?: any;
};

export type SectionOption = {
  title: string;
  label: string;
};

export type SectionsResponse = {
  sections: SectionOption[];
};
