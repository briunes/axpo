"use client";

import { createTheme, type PaletteMode } from "@mui/material/styles";

export function createMuiTheme(mode: PaletteMode = "light") {
  const isDark = mode === "dark";

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
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: "8px",
            fontWeight: 500,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "light"
                ? "#fafafa"
                : theme.palette.background.paper,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.23)"
                  : "rgba(0, 0, 0, 0.23)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.4)"
                  : "rgba(0, 0, 0, 0.4)",
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
            fontWeight: 500,
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
