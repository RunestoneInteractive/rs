import {
  Icon as TablerIconType,
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowLeft,
  IconArrowRight,
  IconBan,
  IconBell,
  IconBolt,
  IconBook,
  IconBrandDiscord,
  IconBulb,
  IconAdjustmentsHorizontal,
  IconArrowsSort,
  IconCalculator,
  IconCalendar,
  IconCalendarX,
  IconChartBar,
  IconCheck,
  IconClick,
  IconCircleCheck,
  IconCircleX,
  IconCode,
  IconLink,
  IconMessage,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircle,
  IconCircleArrowLeft,
  IconCircleArrowRight,
  IconCircleHalf2,
  IconCircleMinus,
  IconClipboardList,
  IconClock,
  IconCopy,
  IconDeviceFloppy,
  IconDotsVertical,
  IconDownload,
  IconDragDrop,
  IconExternalLink,
  IconForms,
  IconEye,
  IconEyeOff,
  IconFile,
  IconFileText,
  IconFilter,
  IconFilterFilled,
  IconFlag,
  IconGripVertical,
  IconHelpCircle,
  IconHistory,
  IconHome,
  IconInbox,
  IconInfoCircle,
  IconLayoutGrid,
  IconList,
  IconListSearch,
  IconLogout,
  IconMail,
  IconMaximize,
  IconMenu2,
  IconMinimize,
  IconMinus,
  IconPalette,
  IconPencil,
  IconPercentage,
  IconPuzzle,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlus,
  IconRefresh,
  IconRosetteDiscountCheck,
  IconSearch,
  IconSettings,
  IconSquareCheck,
  IconStar,
  IconTable,
  IconTrash,
  IconUser,
  IconUsers,
  IconVideo,
  IconX
} from "@tabler/icons-react";
import React from "react";

export type PrimeIconName =
  | "plus"
  | "minus"
  | "eye"
  | "eye-slash"
  | "percentage"
  | "clock"
  | "exclamation-triangle"
  | "times"
  | "pencil"
  | "lightbulb"
  | "info-circle"
  | "trash"
  | "check"
  | "check-circle"
  | "search"
  | "book"
  | "angle-right"
  | "angle-down"
  | "angle-left"
  | "angle-up"
  | "chevron-right"
  | "chevron-left"
  | "chevron-down"
  | "chevron-up"
  | "list"
  | "calendar"
  | "calendar-times"
  | "refresh"
  | "question-circle"
  | "copy"
  | "users"
  | "user"
  | "bolt"
  | "verified"
  | "forward"
  | "history"
  | "undo"
  | "filter"
  | "filter-fill"
  | "th-large"
  | "table"
  | "file-edit"
  | "star"
  | "save"
  | "calculator"
  | "inbox"
  | "circle"
  | "circle-half"
  | "minus-circle"
  | "cog"
  | "sign-out"
  | "home"
  | "ellipsis-v"
  | "download"
  | "external-link"
  | "bell"
  | "file"
  | "arrow-left"
  | "arrow-right"
  | "check-square"
  | "palette"
  | "ban"
  | "video"
  | "envelope"
  | "discord"
  | "window-maximize"
  | "window-minimize"
  | "bars"
  | "menu"
  | "times-circle"
  | "link"
  | "comment"
  | "sort-alt"
  | "sliders-h"
  | "code"
  | "circle-arrow-left"
  | "circle-arrow-right"
  | "flag"
  | "play"
  | "clipboard-list"
  | "chart-bar"
  | "puzzle"
  | "drag-drop"
  | "click"
  | "forms"
  | "list-search";

const MAP: Record<PrimeIconName, TablerIconType> = {
  plus: IconPlus,
  minus: IconMinus,
  eye: IconEye,
  "eye-slash": IconEyeOff,
  percentage: IconPercentage,
  clock: IconClock,
  "exclamation-triangle": IconAlertTriangle,
  times: IconX,
  pencil: IconPencil,
  lightbulb: IconBulb,
  "info-circle": IconInfoCircle,
  trash: IconTrash,
  check: IconCheck,
  "check-circle": IconCircleCheck,
  search: IconSearch,
  book: IconBook,
  "angle-right": IconChevronRight,
  "angle-down": IconChevronDown,
  "angle-left": IconChevronLeft,
  "angle-up": IconChevronUp,
  "chevron-right": IconChevronRight,
  "chevron-left": IconChevronLeft,
  "chevron-down": IconChevronDown,
  "chevron-up": IconChevronUp,
  list: IconList,
  calendar: IconCalendar,
  "calendar-times": IconCalendarX,
  refresh: IconRefresh,
  "question-circle": IconHelpCircle,
  copy: IconCopy,
  users: IconUsers,
  user: IconUser,
  bolt: IconBolt,
  verified: IconRosetteDiscountCheck,
  forward: IconPlayerTrackNext,
  history: IconHistory,
  undo: IconArrowBackUp,
  filter: IconFilter,
  "filter-fill": IconFilterFilled,
  "th-large": IconLayoutGrid,
  table: IconTable,
  "file-edit": IconFileText,
  star: IconStar,
  save: IconDeviceFloppy,
  calculator: IconCalculator,
  inbox: IconInbox,
  circle: IconCircle,
  "circle-half": IconCircleHalf2,
  "minus-circle": IconCircleMinus,
  cog: IconSettings,
  "sign-out": IconLogout,
  home: IconHome,
  "ellipsis-v": IconDotsVertical,
  download: IconDownload,
  "external-link": IconExternalLink,
  bell: IconBell,
  file: IconFile,
  "arrow-left": IconArrowLeft,
  "arrow-right": IconArrowRight,
  "check-square": IconSquareCheck,
  palette: IconPalette,
  ban: IconBan,
  video: IconVideo,
  envelope: IconMail,
  discord: IconBrandDiscord,
  "window-maximize": IconMaximize,
  "window-minimize": IconMinimize,
  bars: IconGripVertical,
  menu: IconMenu2,
  "times-circle": IconCircleX,
  link: IconLink,
  comment: IconMessage,
  "sort-alt": IconArrowsSort,
  "sliders-h": IconAdjustmentsHorizontal,
  code: IconCode,
  "circle-arrow-left": IconCircleArrowLeft,
  "circle-arrow-right": IconCircleArrowRight,
  flag: IconFlag,
  play: IconPlayerPlay,
  "clipboard-list": IconClipboardList,
  "chart-bar": IconChartBar,
  puzzle: IconPuzzle,
  "drag-drop": IconDragDrop,
  click: IconClick,
  forms: IconForms,
  "list-search": IconListSearch
};

interface IconProps {
  name: PrimeIconName;
  size?: number | string;
  color?: string;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
  title?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 16,
  color,
  stroke = 1.8,
  className,
  style,
  title,
  "aria-hidden": ariaHidden = true
}) => {
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      color={color}
      stroke={stroke}
      className={className}
      style={style}
      aria-hidden={ariaHidden}
      title={title}
    />
  );
};
