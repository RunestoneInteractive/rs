import { InputText } from "primereact/inputtext";
import { classNames } from "primereact/utils";

import styles from "./SearchInput.module.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput = ({ value, onChange, placeholder, className }: SearchInputProps) => {
  return (
    <div className={classNames(styles.searchWrapper, className)}>
      <i className={classNames("pi pi-search", styles.searchIcon)} />
      <InputText
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.searchInput}
      />
    </div>
  );
};
