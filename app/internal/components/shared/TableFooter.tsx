"use client";

import { Box, Typography } from "@mui/material";
import { useI18n } from "../../../../src/lib/i18n-context";

export function TableFooter({ totalRows, visibleRows }: { totalRows: number; visibleRows: number }) {
  const { t } = useI18n();

  return (
    <Box sx={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
      <Typography className="table-caption" variant="caption" color="text.secondary">
        {t("common", "showingRows", { visible: visibleRows, total: totalRows })}
      </Typography>
      <div className="pager-inline" aria-label={t("common", "paginationPreview")}>
        <span className="pager-pill is-active">1</span>
        <span className="pager-pill">2</span>
        <span className="pager-pill">3</span>
      </div>
    </Box>
  );
}
