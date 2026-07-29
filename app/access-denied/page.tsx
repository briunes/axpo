"use client";

import { useMemo } from "react";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Chip, CssBaseline, Paper, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { useI18n } from "../../src/lib/i18n-context";
import {
  ThemeModeProvider,
  useThemeMode,
} from "../internal/lib/ThemeModeContext";
import { createMuiTheme } from "../internal/lib/muiTheme";

function AccessDeniedContent() {
  const { t } = useI18n();
  const { mode } = useThemeMode();
  const theme = useMemo(() => createMuiTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        component="main"
        sx={(muiTheme) => ({
          minHeight: "inherit",
          display: "grid",
          placeItems: "center",
          boxSizing: "border-box",
          px: { xs: 2, sm: 3 },
          py: { xs: 3, sm: 6 },
          background:
            muiTheme.palette.mode === "dark"
              ? "radial-gradient(circle at 15% 15%, rgba(255, 50, 84, 0.12), transparent 34%), linear-gradient(145deg, #111111 0%, #161616 55%, #1c1013 100%)"
              : "radial-gradient(circle at 15% 15%, rgba(255, 50, 84, 0.09), transparent 32%), linear-gradient(145deg, #f8fafc 0%, #ffffff 55%, #fff5f7 100%)",
        })}
      >
        <Paper
          component="section"
          variant="outlined"
          aria-labelledby="access-denied-title"
          sx={(muiTheme) => ({
            width: "100%",
            maxWidth: 560,
            boxSizing: "border-box",
            p: { xs: 3, sm: 6 },
            borderRadius: { xs: 2.5, sm: 3 },
            textAlign: "center",
            boxShadow:
              muiTheme.palette.mode === "dark"
                ? "0 24px 70px rgba(0, 0, 0, 0.38)"
                : "0 24px 70px rgba(20, 28, 45, 0.12)",
          })}
        >
          <Box
            component="img"
            src="/axpo-logo.svg"
            width={132}
            height={63}
            alt="AXPO"
            sx={{
              display: "block",
              width: 132,
              height: "auto",
              mx: "auto",
              mb: { xs: 3.5, sm: 4.75 },
            }}
          />

          <Box
            aria-hidden="true"
            sx={(muiTheme) => ({
              display: "grid",
              placeItems: "center",
              width: 72,
              height: 72,
              mx: "auto",
              mb: 3,
              borderRadius: "50%",
              color: "error.main",
              bgcolor:
                muiTheme.palette.mode === "dark"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(239, 68, 68, 0.09)",
            })}
          >
            <LockOutlinedIcon sx={{ fontSize: 36 }} />
          </Box>

          <Typography
            component="p"
            color="error.main"
            sx={{
              mb: 1.25,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
            }}
          >
            {t("accessDenied", "eyebrow")}
          </Typography>
          <Typography
            component="h1"
            id="access-denied-title"
            variant="h1"
            sx={{
              fontSize: { xs: 26, sm: 36 },
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
            }}
          >
            {t("accessDenied", "title")}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{
              maxWidth: 440,
              mx: "auto",
              mt: 2.5,
              fontSize: { xs: 14, sm: 16 },
              lineHeight: 1.65,
            }}
          >
            {t("accessDenied", "description")}
          </Typography>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default function AccessDeniedPage() {
  return (
    <ThemeModeProvider>
      <AccessDeniedContent />
    </ThemeModeProvider>
  );
}
