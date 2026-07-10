"use client";

import { Box, TextField, Typography } from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";

export function SectionToolbar({
  searchValue,
  onSearchChange,
  totalRows,
  visibleRows,
  searchPlaceholder,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  totalRows: number;
  visibleRows: number;
  searchPlaceholder: string;
}) {
  const { t } = useI18n();

  return (
    <Box sx={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
      <div className="toolbar-meta">
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t("common", "rows")}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>{visibleRows}/{totalRows}</Typography>
      </div>
      <TextField
        id="section-search"
        size="small"
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        sx={{ width: { xs: "100%", sm: 360 } }}
      />
    </Box>
  );
}
