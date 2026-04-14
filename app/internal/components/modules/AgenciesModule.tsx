"use client";

import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import { useEffect, useRef, useState } from "react";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem } from "../../lib/internalApi";
import { isAdmin } from "../../lib/internalApi";
import type { AgenciesActions } from "../hooks/useAgencies";
import { ConfirmDialog } from "../shared";
import { DataTable, StatusBadge } from "../ui";
import type { ColumnDef } from "../ui";
import Link from "next/link";
import { useI18n } from "../../../../src/lib/i18n-context";

interface AgenciesModuleProps {
  session: SessionState;
  actions: AgenciesActions;
  onNotify?: (text: string, tone: "success" | "error") => void;
}

export function AgenciesModule({ session, actions, onNotify }: AgenciesModuleProps) {
  const { t } = useI18n();
  const {
    agencies, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize,
    sortColumn, sortDir, setSort,
    search, setSearch,
    handleToggleAgencyStatus,
  } = actions;

  const [confirmToggle, setConfirmToggle] = useState<AgencyItem | null>(null);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    refresh();
  }, []);

  // Re-fetch when pagination/sort/search change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    refresh();
  }, [page, pageSize, sortColumn, sortDir, search]);

  // Bubble success up
  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
    }
  }, [successText]);

  // Bubble errors
  useEffect(() => {
    if (errorText) {
      onNotify?.(errorText, "error");
      clearFeedback();
    }
  }, [errorText]);

  const expandingBtn = {
    minWidth: 0,
    width: 32,
    px: 0,
    overflow: "hidden",
    transition: "width 0.22s ease, padding 0.22s ease",
    "& .btn-label": {
      opacity: 0,
      width: 0,
      overflow: "hidden",
      whiteSpace: "nowrap",
      transition: "opacity 0.18s ease, width 0.22s ease",
    },
  };

  const columns: ColumnDef<AgencyItem>[] = [
    {
      key: "name",
      label: t("columns", "name"),
      sortable: true,
      renderCell: (a) => (
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>{a.name}</Typography>
          {(a.city || a.province) && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
              {[a.city, a.province].filter(Boolean).join(", ")}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: "address",
      label: t("columns", "address"),
      renderCell: (a) => {
        const hasAddress = a.street || a.city || a.postalCode;
        return (
          <Box>
            {hasAddress ? (
              <>
                {a.street && <Typography variant="body2" sx={{ fontSize: 13 }}>{a.street}</Typography>}
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                  {[a.postalCode, a.city].filter(Boolean).join(" ")}
                  {a.country && `, ${a.country}`}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                —
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: "commercialUsers",
      label: t("columns", "commercialUsers"),
      renderCell: (a) => {
        const commercialUsers = a.users?.filter(u => u.role === "COMMERCIAL") || [];
        return (
          <Box>
            {commercialUsers.length > 0 ? (
              <Tooltip
                title={
                  <Box>
                    {commercialUsers.map(u => (
                      <Typography key={u.id} variant="body2" sx={{ fontSize: 12 }}>
                        {u.fullName} ({u.email})
                      </Typography>
                    ))}
                  </Box>
                }
                placement="top"
              >
                <Typography variant="body2" sx={{ cursor: "help" }}>
                  {commercialUsers.length} user{commercialUsers.length !== 1 ? "s" : ""}
                </Typography>
              </Tooltip>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                {t("status", "noUsers")}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: "status",
      label: t("columns", "status"),
      renderCell: (a) => (
        <StatusBadge
          label={a.isActive ? t("status", "active") : t("status", "inactive")}
          tone={a.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      key: "createdAt",
      label: t("columns", "created"),
      width: "220",
      sortable: true,
      renderCell: (a) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            System
          </span>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      width: "220",
      sortable: true,
      renderCell: (a) => (
        <Typography variant="body2" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(a.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
          {" - "}
          <span style={{ color: "var(--scheme-neutral-400)", fontStyle: "italic" }}>
            System
          </span>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      width: "120",
      renderCell: (a) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {/* Edit */}
          <Tooltip title={t("agenciesModule", "editAgency_tooltip")} placement="top">
            <IconButton
              component={Link}
              href={`/internal/agencies/${a.id}/edit`}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Activate / Deactivate */}
          <Tooltip title={a.isActive ? t("agenciesModule", "deactivateAgency_tooltip") : t("agenciesModule", "activateAgency_tooltip")} placement="top">
            <IconButton
              onClick={() => setConfirmToggle(a)}

              size="small"
              sx={{ color: a.isActive ? "error.main" : "success.main" }}
            >
              {a.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  if (!isAdmin(session.user.role)) {
    return (
      <Stack spacing={2}>
        <h2 className="section-title">{t("nav", "agencies")}</h2>
        <p className="section-subtitle">{t("agenciesModule", "noPermission")}</p>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <div className="section-header">
        <div>
          <h2 className="section-title">{t("nav", "agencies")}</h2>
          <p className="section-subtitle">{t("agenciesModule", "subtitle")}</p>
        </div>
        <div className="section-actions">
          <Button
            variant="outlined"
            size="small"
            onClick={() => refresh()}
            disabled={loading}
            loading={loading}
          >
            <SyncIcon fontSize="small" />&nbsp;{t("actions", "refresh")}
          </Button>
          <Link href="/internal/agencies/new" style={{ textDecoration: "none" }}>
            <Button variant="contained" size="small">{t("actions", "newAgency")}</Button>
          </Link>
        </div>
      </div>

      <DataTable<AgencyItem>
        columns={columns}
        rows={agencies}
        loading={loading}
        searchValue={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t("search", "agencies")}
        emptyMessage={t("search", "emptyAgencies")}
        sortState={{ column: sortColumn, direction: sortDir }}
        onSort={(col) => {
          const newDir = col === sortColumn && sortDir === "asc" ? "desc" : "asc";
          setSort(col, newDir);
          setPage(1);
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
        }}
        headerRight={<span className="dt-meta-pill">{total} total</span>}
      />

      {/* ── Confirm toggle ────────────────────────────────────────── */}
      {confirmToggle && (
        <ConfirmDialog
          title={`${confirmToggle.isActive ? t("actions", "deactivate") : t("actions", "activate")} ${t("agenciesModule", "toggleTitle")}`}
          message={t("agenciesModule", "toggleConfirm", { action: confirmToggle.isActive ? t("actions", "deactivate").toLowerCase() : t("actions", "activate").toLowerCase(), name: confirmToggle.name })}
          confirmLabel={t("actions", "confirm")}
          busy={busyAction === `toggle-agency-${confirmToggle.id}`}
          onConfirm={async () => {
            await handleToggleAgencyStatus(confirmToggle);
            setConfirmToggle(null);
          }}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </Stack>
  );
}
