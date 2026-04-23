"use client";

import { createTheme } from "@mui/material/styles";

// AXPO Logo Gradient Colors
// Extracted from axpo-mark.svg gradient:
// Yellow → Red/Pink → Magenta → Purple → Blue
const axpoColors = {
  yellow: "#FFED57",
  redLight: "#FF5D64",
  red: "#FF3254",
  magenta: "#FF416A",
  pink: "#E54278",
  purple: "#8F43A7",
  purpleDark: "#5A45C4",
  blue: "#4545CF",
};

export const muiTheme = createTheme({
  palette: {
    mode: "light",
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
    background: {
      default: "#ffffff",
      paper: "#ffffff",
    },
    text: {
      primary: "#2b2b2b",
      secondary: "#6b6b6b",
    },
    divider: "rgba(0, 0, 0, 0.12)",
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
    fontFamily: 'var(--font-montserrat, "Montserrat"), "Segoe UI", sans-serif',
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
