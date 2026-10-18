import "react-datepicker/dist/react-datepicker.css";

import { Icon } from "@components/ui/Icon";
import classNames from "classnames";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import DatePicker from "react-datepicker";

import { convertDateToISO, getDatePickerFormat, parseUTCDate } from "@/utils/date";

import styles from "./DateTimePicker.module.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const getFocusableElements = (container: ParentNode) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[hidden], [aria-hidden='true']")
  );

/**
 * The picker shows and edits dates in the viewer's local timezone, but every
 * datetime the backend stores -- duedate, visible_on, hidden_on -- is naive
 * UTC, so values always cross this boundary as UTC.
 */
interface DateTimePickerProps {
  value: string | null | undefined;
  onChange: (isoString: string) => void;
  placeholder?: string;
  className?: string;
  /** If false, render the calendar inline instead of portaling it to #root. */
  withinPortal?: boolean;
  id?: string;
  ariaLabel?: string;
  onCalendarOpen?: () => void;
  onCalendarClose?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

export const DateTimePicker = ({
  value,
  onChange,
  placeholder = "Select date and time",
  className,
  withinPortal = true,
  id,
  ariaLabel,
  onCalendarOpen,
  onCalendarClose,
  onKeyDown
}: DateTimePickerProps) => {
  const focusScopeClass = `date-time-picker-${useId().replaceAll(":", "")}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<DatePicker>(null);
  const [calendarOpened, setCalendarOpened] = useState(false);

  useEffect(() => {
    if (!calendarOpened) {
      return;
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;

      if (
        !(target instanceof Element) ||
        wrapperRef.current?.contains(target) ||
        target.closest(`.${focusScopeClass}`)
      ) {
        return;
      }

      datePickerRef.current?.setOpen(false);
    };

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab" || !(event.target instanceof HTMLElement)) {
        return;
      }

      const calendar = event.target.closest<HTMLElement>(`.${focusScopeClass}`);

      if (!calendar) {
        return;
      }

      const calendarFocusables = getFocusableElements(calendar);
      const boundaryElement = event.shiftKey ? calendarFocusables.at(0) : calendarFocusables.at(-1);

      if (event.target !== boundaryElement) {
        return;
      }

      const input = wrapperRef.current?.querySelector<HTMLElement>("input");
      const pageFocusables = getFocusableElements(document).filter(
        (element) => !element.closest(`.${focusScopeClass}`)
      );
      const inputIndex = input ? pageFocusables.indexOf(input) : -1;
      const destination = pageFocusables[inputIndex + (event.shiftKey ? -1 : 1)];

      if (!destination) {
        return;
      }

      event.preventDefault();
      datePickerRef.current?.setOpen(false);
      destination.focus();
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [calendarOpened, focusScopeClass]);

  const handleChange = (date: Date | null) => {
    if (date) {
      onChange(convertDateToISO(date));
    }
  };

  const parseDate = (val: string) => parseUTCDate(val);

  const handleCalendarOpen = () => {
    setCalendarOpened(true);
    onCalendarOpen?.();
  };

  const handleCalendarClose = () => {
    setCalendarOpened(false);
    onCalendarClose?.();
  };

  return (
    <div ref={wrapperRef} className={classNames(styles.wrapper, className)}>
      <DatePicker
        ref={datePickerRef}
        selected={value ? parseDate(value) : null}
        onChange={handleChange}
        showTimeSelect
        timeIntervals={5}
        dateFormat={getDatePickerFormat()}
        placeholderText={placeholder}
        className={styles.input}
        calendarClassName={classNames(styles.calendar, focusScopeClass)}
        wrapperClassName={styles.datepickerWrapper}
        showIcon
        icon={<Icon name="calendar" />}
        popperClassName={classNames(styles.popper, focusScopeClass)}
        enableTabLoop={false}
        portalId={withinPortal ? "root" : undefined}
        id={id}
        customInput={ariaLabel ? <input type="text" aria-label={ariaLabel} /> : undefined}
        onCalendarOpen={handleCalendarOpen}
        onCalendarClose={handleCalendarClose}
        onKeyDown={onKeyDown}
      />
    </div>
  );
};
