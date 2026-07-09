import { createTheme, MantineColorsTuple } from "@mantine/core";

const brand: MantineColorsTuple = [
  "#eef2ff",
  "#e0e7ff",
  "#c7d2fe",
  "#a5b4fc",
  "#818cf8",
  "#6366f1",
  "#4f46e5",
  "#4338ca",
  "#3730a3",
  "#312e81"
];

const slate: MantineColorsTuple = [
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#cbd5e1",
  "#94a3b8",
  "#64748b",
  "#475569",
  "#334155",
  "#1e293b",
  "#0f172a"
];

const SANS_FONT_STACK = "var(--rs-font-sans)";

const MONO_FONT_STACK = "var(--rs-font-mono)";

export const mantineTheme = createTheme({
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 5 },
  colors: {
    brand,
    slate
  },
  defaultRadius: "md",
  fontFamily: SANS_FONT_STACK,
  fontFamilyMonospace: MONO_FONT_STACK,
  headings: { fontFamily: SANS_FONT_STACK, fontWeight: "650" },
  radius: {
    xs: "6px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px"
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem"
  },
  fontSizes: {
    xs: "0.75rem",
    sm: "0.8125rem",
    md: "0.875rem",
    lg: "1rem",
    xl: "1.25rem"
  },
  shadows: {
    xs: "var(--rs-shadow-xs)",
    sm: "var(--rs-shadow-sm)",
    md: "var(--rs-shadow-md)",
    lg: "var(--rs-shadow-overlay)",
    xl: "var(--rs-shadow-modal)"
  },
  components: {
    Modal: {
      defaultProps: {
        radius: "lg",
        shadow: "xl",
        overlayProps: { blur: 2 },
        transitionProps: { transition: "pop", duration: 200 }
      }
    },
    Tooltip: {
      defaultProps: {
        transitionProps: { duration: 150 }
      }
    },
    Popover: {
      defaultProps: {
        shadow: "lg",
        transitionProps: { duration: 180 }
      }
    },
    Menu: {
      defaultProps: {
        shadow: "lg",
        transitionProps: { duration: 180 }
      }
    },
    Notification: {
      defaultProps: {
        radius: "md",
        closeButtonProps: { "aria-label": "Dismiss notification" }
      },
      styles: {
        root: { boxShadow: "var(--rs-shadow-overlay)" }
      }
    }
  }
});
