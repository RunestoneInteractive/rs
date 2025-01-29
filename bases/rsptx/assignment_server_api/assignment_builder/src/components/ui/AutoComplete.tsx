import {
  AutoComplete as PrimeAutoComplete,
  AutoCompleteProps as PrimeAutoCompleteProps,
  AutoCompleteSelectEvent
} from "primereact/autocomplete";
import { useState } from "react";

interface AutoCompleteProps extends PrimeAutoCompleteProps {
  defaultOption?: string;
  searchMethod?: "startsWith" | "includes";
  suggestions: string[];
}

export const AutoComplete = (props: AutoCompleteProps) => {
  const [searchValue, setSearchValue] = useState(props.value);
  const [filteredValues, setFilteredValues] = useState(props.suggestions);
  const { defaultOption, ...restProps } = props;

  const search = ({ query }: { query: string }): void => {
    if (!query.trim().length) {
      setFilteredValues([...props.suggestions]);
      return;
    }

    const searchMethod = props.searchMethod ?? "includes";

    const matches = props.suggestions.filter((suggestion) =>
      suggestion.toLowerCase()[searchMethod](query.toLowerCase())
    );

    if (!matches.length && !!defaultOption) {
      setFilteredValues([defaultOption]);
      return;
    }

    setFilteredValues(matches);
  };

  const onSelect = (event: AutoCompleteSelectEvent) => {
    if (event.value === defaultOption) {
      setSearchValue(searchValue);
      props.onSelect?.({ originalEvent: event.originalEvent, value: searchValue });
      return;
    }

    props.onSelect?.(event);
  };

  return (
    <PrimeAutoComplete
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...restProps}
      suggestions={filteredValues}
      value={searchValue}
      completeMethod={search}
      onChange={(e) => setSearchValue(e.value)}
      onSelect={onSelect}
      dropdown
      id="name"
      name="name"
    />
  );
};
