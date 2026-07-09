import { Icon } from "@components/ui/Icon";
import { TextInput } from "@mantine/core";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export const SearchInput = ({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel
}: SearchInputProps) => {
  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder ?? "Search"}
      className={className}
      leftSection={<Icon name="search" />}
    />
  );
};
