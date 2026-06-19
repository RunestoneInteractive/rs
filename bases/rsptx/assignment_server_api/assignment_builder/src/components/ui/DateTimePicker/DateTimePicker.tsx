import "react-datepicker/dist/react-datepicker.css";

import { Icon } from "@components/ui/Icon";
import classNames from "classnames";
import DatePicker from "react-datepicker";

import {
  convertDateToISO,
  convertDateToLocalISO,
  getDatePickerFormat,
  parseUTCDate,
  parseLocalDate
} from "@/utils/date";

import styles from "./DateTimePicker.module.css";

interface DateTimePickerProps {
  value: string | null | undefined;
  onChange: (isoString: string) => void;
  placeholder?: string;
  className?: string;
  /** If true, treat dates as UTC. If false (default), treat as local time. */
  utc?: boolean;
  /** If false, render the calendar inline instead of portaling it to #root. */
  withinPortal?: boolean;
  id?: string;
  ariaLabel?: string;
}

export const DateTimePicker = ({
  value,
  onChange,
  placeholder = "Select date and time",
  className,
  utc = false,
  withinPortal = true,
  id,
  ariaLabel
}: DateTimePickerProps) => {
  const handleChange = (date: Date | null) => {
    if (date) {
      onChange(utc ? convertDateToISO(date) : convertDateToLocalISO(date));
    }
  };

  const parseDate = (val: string) => (utc ? parseUTCDate(val) : parseLocalDate(val));

  return (
    <div className={classNames(styles.wrapper, className)}>
      <DatePicker
        selected={value ? parseDate(value) : null}
        onChange={handleChange}
        showTimeSelect
        timeIntervals={5}
        dateFormat={getDatePickerFormat()}
        placeholderText={placeholder}
        className={styles.input}
        calendarClassName={styles.calendar}
        wrapperClassName={styles.datepickerWrapper}
        showIcon
        icon={<Icon name="calendar" />}
        popperClassName={styles.popper}
        portalId={withinPortal ? "root" : undefined}
        id={id}
        customInput={ariaLabel ? <input type="text" aria-label={ariaLabel} /> : undefined}
      />
    </div>
  );
};
