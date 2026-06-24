"use client";

import { createTheme, type PaletteMode } from "@mui/material/styles";

export function createMuiTheme(mode: PaletteMode = "light") {
  const isDark = mode === "dark";
  const shadows = [
    "none",
    isDark ? "0 1px 2px rgba(0, 0, 0, 0.36)" : "0 1px 2px rgba(16, 24, 40, 0.06)",
    isDark ? "0 8px 24px rgba(0, 0, 0, 0.34)" : "0 8px 24px rgba(16, 24, 40, 0.08)",
    isDark ? "0 12px 32px rgba(0, 0, 0, 0.38)" : "0 12px 32px rgba(16, 24, 40, 0.10)",
    isDark ? "0 18px 46px rgba(0, 0, 0, 0.42)" : "0 18px 46px rgba(16, 24, 40, 0.12)",
    ...Array(20).fill(isDark ? "0 22px 54px rgba(0, 0, 0, 0.44)" : "0 22px 54px rgba(16, 24, 40, 0.14)"),
  ] as any;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#FF3254", // AXPO vibrant red (from gradient)
        light: "#FF5D64",
        dark: "#E54278",
        contrastText: "#ffffff",
      },
      secondary: {
        main: "#8F43A7", // AXPO purple (from gradient)
        light: "#A965BD",
        dark: "#5A45C4",
        contrastText: "#ffffff",
      },
      background: isDark
        ? { default: "#111111", paper: "#1c1c1c" }
        : { default: "#ffffff", paper: "#ffffff" },
      text: isDark
        ? { primary: "#f0f0f0", secondary: "#9e9e9e" }
        : { primary: "#2b2b2b", secondary: "#6b6b6b" },
      divider: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.12)",
      error: {
        main: "#ef4444",
      },
      success: {
        main: "#00a651", // AXPO green
      },
      warning: {
        main: "#f59e0b",
      },
      info: {
        main: "#0066b3", // AXPO blue
      },
    },
    shape: {
      borderRadius: 10,
    },
    shadows,
    typography: {
      fontFamily:
        'var(--font-montserrat, "Montserrat"), "Segoe UI", sans-serif',
      fontSize: 14,
      h1: {
        fontSize: "2rem",
        fontWeight: 600,
      },
      h2: {
        fontSize: "1.5rem",
        fontWeight: 600,
      },
      h3: {
        fontSize: "1.25rem",
        fontWeight: 600,
      },
      body1: {
        fontSize: "0.875rem",
      },
      body2: {
        fontSize: "0.8125rem",
      },
    },
    components: {
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: "none",
            borderRadius: "9px",
            fontWeight: 600,
            letterSpacing: 0,
            boxShadow: "none",
            transition: "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 8px 18px rgba(0, 0, 0, 0.24)"
                  : "0 8px 18px rgba(255, 50, 84, 0.13)",
            },
            "&.MuiButton-outlined": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(255, 255, 255, 0.74)",
            },
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            borderColor:
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(16, 24, 40, 0.08)",
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 9,
            backgroundColor:
              theme.palette.mode === "light"
                ? "#ffffff"
                : theme.palette.background.paper,
            transition: "background-color 150ms ease, box-shadow 150ms ease",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.23)"
                  : "rgba(16, 24, 40, 0.18)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.4)"
                  : "rgba(16, 24, 40, 0.34)",
            },
            "&.Mui-focused": {
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 0 0 4px rgba(255, 50, 84, 0.16)"
                  : "0 0 0 4px rgba(255, 50, 84, 0.10)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.primary.main,
            },
          }),
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
          }),
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: "999px",
            fontWeight: 600,
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: "8px",
          },
        },
      },
    },
  });
}

// Default light theme for backward compat (used where mode isn't dynamic yet)
export const muiTheme = createMuiTheme("light");
