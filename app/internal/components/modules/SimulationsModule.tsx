"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Button,
  Badge,
  Typography,
  TextField,
  Box,
  Menu,
  MenuItem,
  ButtonGroup,
  IconButton,
  Popover,
  Stack,
  Tooltip,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import ArchiveIcon from "@mui/icons-material/Archive";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useCallback, useEffect, useMemo, useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../../../src/lib/i18n-context";
import type { SessionState } from "../../lib/authSession";
import type { AgencyItem, ClientItem, SimulationItem, UserItem } from "../../lib/internalApi";
import { getSimulation, isAdmin, simulationStatusTone } from "../../lib/internalApi";
import { usePermissions } from "../../lib/permissionsContext";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { formatDisplayDate } from "../../lib/formatPreferences";
import type { SimulationsActions, SimulationViewState } from "../hooks/useSimulations";
import { ConfirmDialog } from "../shared";
import { DataTable, SlidePanel, StatusBadge, FormInput, FormSelect, DateInput } from "../ui";
import type { ColumnDef } from "../ui";
import { ShareSimulationView } from "../../simulations/[id]/components/ShareSimulationView";

interface SimulationsModuleProps {
  session: SessionState;
  actions: SimulationsActions;
  agencies: AgencyItem[];
  clients: ClientItem[];
  users: UserItem[];
  onNotify?: (text: string, tone: "success" | "error") => void;
  onActionButtons?: (buttons: React.ReactNode) => void;
}

interface SavedSimulationView {
  id: string;
  name: string;
  view: SimulationViewState;
}

const SIMULATION_VIEWS_STORAGE_KEY = "axpo_simulation_saved_views";
const CUSTOM_VIEW_OPTION = "__custom";
const DEFAULT_SORT_COLUMN = "updatedAt";
const DEFAULT_SORT_DIR: "asc" | "desc" = "desc";

function normalizeSimulationView(view: SimulationViewState) {
  return {
    search: view.search ?? "",
    ownerUserId: view.ownerUserId ?? "",
    clientId: view.clientId ?? "",
    cups: view.cups ?? "",
    status: view.status ?? "",
    type: view.type ?? "",
    createdFrom: view.createdFrom ?? "",
    createdTo: view.createdTo ?? "",
    expiresFrom: view.expiresFrom ?? "",
    expiresTo: view.expiresTo ?? "",
    showArchived: Boolean(view.showArchived),
    sortColumn: view.sortColumn ?? DEFAULT_SORT_COLUMN,
    sortDir: view.sortDir ?? DEFAULT_SORT_DIR,
  };
}

function isSameSimulationView(a: SimulationViewState, b: SimulationViewState) {
  const left = normalizeSimulationView(a);
  const right = normalizeSimulationView(b);
  return left.search === right.search
    && left.ownerUserId === right.ownerUserId
    && left.clientId === right.clientId
    && left.cups === right.cups
    && left.status === right.status
    && left.type === right.type
    && left.createdFrom === right.createdFrom
    && left.createdTo === right.createdTo
    && left.expiresFrom === right.expiresFrom
    && left.expiresTo === right.expiresTo
    && left.showArchived === right.showArchived
    && left.sortColumn === right.sortColumn
    && left.sortDir === right.sortDir;
}

function isSamePresetView(a: SimulationViewState, b: SimulationViewState) {
  return isSameSimulationView({ ...a, search: "" }, { ...b, search: "" });
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function loadSavedSimulationViews(): SavedSimulationView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SIMULATION_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSimulationView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedSimulationViews(views: SavedSimulationView[]) {
  try {
    localStorage.setItem(SIMULATION_VIEWS_STORAGE_KEY, JSON.stringify(views));
  } catch {
    // ignore local persistence failures
  }
}

export function SimulationsModule({ session, actions, agencies, clients, users, onNotify, onActionButtons }: SimulationsModuleProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { preferences } = useUserPreferences();
  const { canDo } = usePermissions();
  const {
    simulations, loading, busyAction, errorText, successText, clearFeedback, refresh,
    page, pageSize, total, setPage, setPageSize, sortColumn, sortDir, setSort,
    showArchived, setShowArchived,
    filterSearch, setFilterSearch,
    filterOwnerUserId, setFilterOwnerUserId,
    filterClientId, setFilterClientId,
    filterCups, setFilterCups,
    filterStatus, setFilterStatus,
    filterType, setFilterType,
    filterCreatedFrom, setFilterCreatedFrom,
    filterCreatedTo, setFilterCreatedTo,
    filterExpiresFrom, setFilterExpiresFrom,
    filterExpiresTo, setFilterExpiresTo,
    clearFilters, applyView,
    selectedSimulationId, editPayloadJson, setEditPayloadJson,
    openSimulationEditor, closeSimulationEditor, handleUpdateSimulation,
    handleShare, handleClone, handleRotatePin, handleOcrPrefill, handlePdfDownload, handleArchive,
    handleBulkDelete,
  } = actions;

  const [shareSim, setShareSim] = useState<SimulationItem | null>(null);
  const [shareModalLoading, setShareModalLoading] = useState(false);
  const [confirmDeleteSim, setConfirmDeleteSim] = useState<SimulationItem | null>(null);
  const [confirmBulkDeleteIds, setConfirmBulkDeleteIds] = useState<string[] | null>(null);
  const bulkDeleteIncludesArchived = Boolean(
    confirmBulkDeleteIds?.some((id) => simulations.find((simulation) => simulation.id === id)?.isDeleted),
  );
  const [dropdownState, setDropdownState] = useState<{
    anchorEl: HTMLElement | null;
    items: Array<{ label: string; onClick: () => void; icon?: React.ReactNode; warning?: boolean; danger?: boolean; disabled?: boolean }>;
  }>({ anchorEl: null, items: [] });
  const closeDropdown = () => setDropdownState({ anchorEl: null, items: [] });
  const isAdminRole = isAdmin(session.user.role);
  const canCreateSimulation = canDo(session.user.role, "simulations.create");
  const canArchiveSimulation = canDo(session.user.role, "simulations.archive");
  const canShareSimulation = canDo(session.user.role, "simulations.share");
  const canDuplicateSimulation = canDo(session.user.role, "simulations.duplicate");
  const [savedViews, setSavedViews] = useState<SavedSimulationView[]>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [filtersAnchorEl, setFiltersAnchorEl] = useState<HTMLElement | null>(null);
  const filtersOpen = Boolean(filtersAnchorEl);

  const [draftOwnerUserId, setDraftOwnerUserId] = useState(filterOwnerUserId);
  const [draftClientId, setDraftClientId] = useState(filterClientId);
  const [draftCups, setDraftCups] = useState(filterCups);
  const [draftStatus, setDraftStatus] = useState(filterStatus);
  const [draftType, setDraftType] = useState(filterType);
  const [draftCreatedFrom, setDraftCreatedFrom] = useState(filterCreatedFrom);
  const [draftCreatedTo, setDraftCreatedTo] = useState(filterCreatedTo);
  const [draftExpiresFrom, setDraftExpiresFrom] = useState(filterExpiresFrom);
  const [draftExpiresTo, setDraftExpiresTo] = useState(filterExpiresTo);
  const [draftSortColumn, setDraftSortColumn] = useState(sortColumn);
  const [draftSortDir, setDraftSortDir] = useState<"asc" | "desc">(sortDir);

  useEffect(() => {
    setSavedViews(loadSavedSimulationViews());
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    setDraftOwnerUserId(filterOwnerUserId);
    setDraftClientId(filterClientId);
    setDraftCups(filterCups);
    setDraftStatus(filterStatus);
    setDraftType(filterType);
    setDraftCreatedFrom(filterCreatedFrom);
    setDraftCreatedTo(filterCreatedTo);
    setDraftExpiresFrom(filterExpiresFrom);
    setDraftExpiresTo(filterExpiresTo);
    setDraftSortColumn(sortColumn);
    setDraftSortDir(sortDir);
  }, [
    filterClientId,
    filterCreatedFrom,
    filterCreatedTo,
    filterCups,
    filterExpiresFrom,
    filterExpiresTo,
    filterOwnerUserId,
    filterStatus,
    filterType,
    filtersOpen,
    sortColumn,
    sortDir,
  ]);

  useEffect(() => {
    if (successText) {
      onNotify?.(successText, "success");
      clearFeedback();
    }
  }, [successText]);

  // Render action buttons for topbar
  useLayoutEffect(() => {
    onActionButtons?.(
      <>
        <Tooltip title={t("actions", "refresh")} arrow>
          <span className="topbar-action-wrap">
            <Button
              className="topbar-action topbar-action--compact"
              variant="outlined"
              size="small"
              onClick={() => refresh()}
              disabled={loading}
              startIcon={<SyncIcon fontSize="small" />}
              aria-label={t("actions", "refresh")}
            >
              <span className="topbar-action-label">{t("actions", "refresh")}</span>
            </Button>
          </span>
        </Tooltip>
        {isAdminRole && (
          <Tooltip title={showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")} arrow>
            <span className="topbar-action-wrap">
              <Button
                className="topbar-action topbar-action--compact"
                variant={showArchived ? "contained" : "outlined"}
                size="small"
                onClick={() => setShowArchived(!showArchived)}
                startIcon={<ArchiveIcon fontSize="small" />}
                aria-label={showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
              >
                <span className="topbar-action-label">
                  {showArchived ? t("actions", "hideArchived") : t("actions", "showArchived")}
                </span>
              </Button>
            </span>
          </Tooltip>
        )}
        {canCreateSimulation && (
          <Tooltip title={t("actions", "newSimulation")} arrow>
            <span className="topbar-action-wrap">
              <Button
                className="topbar-action topbar-action--compact"
                variant="contained"
                size="small"
                onClick={() => router.push("/internal/simulations/new")}
                startIcon={<AddIcon fontSize="small" />}
                aria-label={t("actions", "newSimulation")}
              >
                <span className="topbar-action-label">{t("actions", "newSimulation")}</span>
              </Button>
            </span>
          </Tooltip>
        )}
      </>
    );
    return () => onActionButtons?.(null);
  }, [onActionButtons, showArchived, loading, session.user.role, isAdminRole, canCreateSimulation, t, refresh, router, setShowArchived]);

  // Keep the archived toggle as an exclusive view even if a stale response is mixed.
  const displayData = useMemo(
    () => showArchived
      ? simulations.filter((s) => s.isDeleted)
      : simulations.filter((s) => !s.isDeleted),
    [showArchived, simulations],
  );

  const handleShareAction = useCallback(async (sim: SimulationItem) => {
    setShareModalLoading(true);
    setShareSim(sim);
    try {
      const { simulation: freshSim } = await getSimulation(session.token, sim.id);
      setShareSim(freshSim);
    } catch (error) {
      onNotify?.(error instanceof Error ? error.message : "Could not load simulation for sharing.", "error");
    } finally {
      setShareModalLoading(false);
    }
  }, [onNotify, session.token]);

  const timeFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: preferences.timeFormat === "12h",
        timeZone: preferences.timezone,
      });
    } catch {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: preferences.timeFormat === "12h",
      });
    }
  }, [preferences.timeFormat, preferences.timezone]);

  const formatDateTime = useCallback((value: string | null | undefined) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    const datePart = formatDisplayDate(date, preferences.dateFormat);
    const timePart = timeFormatter.format(date);

    return `${datePart} ${timePart}`;
  }, [preferences.dateFormat, timeFormatter]);

  const hasSelectedProduct = useCallback((sim: SimulationItem) => {
    const payload = sim.payloadJson as { selectedOffer?: { productKey?: string } } | null;
    return Boolean(payload?.selectedOffer?.productKey);
  }, []);

  const getSimulationActions = useCallback((sim: SimulationItem) => {
    const isShared = sim.status === "SHARED";
    const canDelete =
      (!sim.isDeleted && canArchiveSimulation) ||
      (Boolean(sim.isDeleted) && isAdminRole);
    const canDraftShare = !sim.isDeleted && sim.status === "DRAFT" && canShareSimulation && hasSelectedProduct(sim);

    const secondaryItems: Array<{
      label: string;
      onClick: () => void;
      icon?: React.ReactNode;
      warning?: boolean;
      danger?: boolean;
      disabled?: boolean;
    }> = [];

    if (canDraftShare) {
      secondaryItems.push({
        label: t("actions", "share"),
        warning: true,
        icon: <ShareIcon fontSize="small" />,
        onClick: () => handleShareAction(sim),
      });
    }
    if (canDuplicateSimulation) {
      secondaryItems.push({
        label: t("actions", "duplicate"),
        icon: <ContentCopyIcon fontSize="small" />,
        onClick: () => handleClone(sim),
        disabled: busyAction === `clone-${sim.id}`,
      });
    }
    if (canDelete) {
      secondaryItems.push({
        label: t("actions", "delete"),
        icon: <DeleteIcon fontSize="small" />,
        onClick: () => setConfirmDeleteSim(sim),
        danger: true,
      });
    }

    return {
      primaryLabel: isShared ? t("actions", "view") : t("actions", "simulate"),
      primaryIcon: isShared ? <VisibilityIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />,
      primaryOnClick: () => router.push(
        isShared ? `/internal/simulations/${sim.id}/view` : `/internal/simulations/${sim.id}`,
      ),
      secondaryItems,
    };
  }, [
    busyAction,
    canArchiveSimulation,
    canDuplicateSimulation,
    canShareSimulation,
    handleClone,
    handleShareAction,
    hasSelectedProduct,
    isAdminRole,
    router,
    t,
  ]);

  const getSimulationReference = (sim: SimulationItem) =>
    sim.referenceNumber || sim.id.slice(0, 8) + "…";

  const getSimulationType = useCallback((sim: SimulationItem) => {
    const payload = sim.payloadJson as { type?: string } | null;
    return payload?.type;
  }, []);

  const ownerOptions = useMemo(
    () => [
      { value: "", label: t("search", "allOwners") },
      ...Array.from(new Map(
        users
          .filter((user) => user.isActive)
          .map((user) => [user.id, user]),
      ).values())
        .map((user) => ({
          value: user.id,
          label: user.fullName || user.email,
          secondaryLabel: user.email,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [t, users],
  );

  const clientOptions = useMemo(
    () => [
      { value: "", label: t("search", "allClients") },
      ...clients
        .filter((client) => !client.isDeleted)
        .map((client) => ({
          value: client.id,
          label: client.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [clients, t],
  );

  const currentView = useMemo<SimulationViewState>(() => ({
    search: filterSearch,
    ownerUserId: filterOwnerUserId,
    clientId: filterClientId,
    cups: filterCups,
    status: filterStatus,
    type: filterType,
    createdFrom: filterCreatedFrom,
    createdTo: filterCreatedTo,
    expiresFrom: filterExpiresFrom,
    expiresTo: filterExpiresTo,
    showArchived,
    sortColumn,
    sortDir,
  }), [
    filterClientId,
    filterCreatedFrom,
    filterCreatedTo,
    filterCups,
    filterExpiresFrom,
    filterExpiresTo,
    filterOwnerUserId,
    filterSearch,
    filterStatus,
    filterType,
    showArchived,
    sortColumn,
    sortDir,
  ]);

  const builtInViews = useMemo<Array<{ id: string; name: string; view: SimulationViewState }>>((): Array<{ id: string; name: string; view: SimulationViewState }> => [
    {
      id: "recent",
      name: t("simulationsModule", "presetRecent"),
      view: { search: "", ownerUserId: "", clientId: "", cups: "", status: "", type: "", createdFrom: "", createdTo: "", expiresFrom: "", expiresTo: "", sortColumn: "updatedAt", sortDir: "desc", showArchived: false },
    },
    {
      id: "my-drafts",
      name: t("simulationsModule", "presetMyDrafts"),
      view: { search: "", ownerUserId: session.user.id, clientId: "", cups: "", status: "DRAFT", type: "", createdFrom: "", createdTo: "", expiresFrom: "", expiresTo: "", showArchived: false, sortColumn: "updatedAt", sortDir: "desc" },
    },
    {
      id: "shared-with-me",
      name: t("simulationsModule", "presetSharedWithMe"),
      view: { search: "", ownerUserId: session.user.role === "COMMERCIAL" ? session.user.id : "", clientId: "", cups: "", status: "SHARED", type: "", createdFrom: "", createdTo: "", expiresFrom: "", expiresTo: "", showArchived: false, sortColumn: "updatedAt", sortDir: "desc" },
    },
    {
      id: "expiring-soon",
      name: t("simulationsModule", "presetExpiringSoon"),
      view: {
        search: "",
        ownerUserId: "",
        clientId: "",
        cups: "",
        status: "",
        type: "",
        createdFrom: "",
        createdTo: "",
        expiresFrom: isoDate(new Date()),
        expiresTo: isoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        showArchived: false,
        sortColumn: "expiresAt",
        sortDir: "asc",
      },
    },
    {
      id: "archived",
      name: t("simulationsModule", "presetArchived"),
      view: { search: "", ownerUserId: "", clientId: "", cups: "", status: "", type: "", createdFrom: "", createdTo: "", expiresFrom: "", expiresTo: "", showArchived: true, sortColumn: "updatedAt", sortDir: "desc" },
    },
  ], [session.user.id, session.user.role, t]);

  const viewPresets = useMemo(
    () => [
      ...builtInViews.map((view) => ({ ...view, kind: "default" as const })),
      ...savedViews.map((view) => ({ ...view, kind: "saved" as const })),
    ],
    [builtInViews, savedViews],
  );

  const activeViewPresetId = useMemo(
    () => viewPresets.find((preset) => isSamePresetView(preset.view, currentView))?.id,
    [currentView, viewPresets],
  );

  const saveCurrentView = useCallback(() => {
    const trimmed = saveViewName.trim();
    if (!trimmed) return;
    const nextViews = [
      ...savedViews.filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase()),
      {
        id: `view-${Date.now()}`,
        name: trimmed,
        view: { ...currentView, search: "" },
      },
    ];
    setSavedViews(nextViews);
    persistSavedSimulationViews(nextViews);
    setSaveViewName("");
    setSaveViewOpen(false);
  }, [currentView, saveViewName, savedViews]);

  const deleteSavedView = useCallback((id: string) => {
    const nextViews = savedViews.filter((view) => view.id !== id);
    setSavedViews(nextViews);
    persistSavedSimulationViews(nextViews);
  }, [savedViews]);

  const activeAdvancedFilterCount = useMemo(() => [
    !activeViewPresetId && session.user.role !== "COMMERCIAL" && filterOwnerUserId,
    !activeViewPresetId && filterClientId,
    !activeViewPresetId && filterCups,
    !activeViewPresetId && filterStatus,
    !activeViewPresetId && filterType,
    !activeViewPresetId && (filterCreatedFrom || filterCreatedTo),
    !activeViewPresetId && (filterExpiresFrom || filterExpiresTo),
    !activeViewPresetId && (sortColumn !== DEFAULT_SORT_COLUMN || sortDir !== DEFAULT_SORT_DIR),
  ].filter(Boolean).length, [
    activeViewPresetId,
    filterClientId,
    filterCreatedFrom,
    filterCreatedTo,
    filterCups,
    filterExpiresFrom,
    filterExpiresTo,
    filterOwnerUserId,
    filterStatus,
    filterType,
    session.user.role,
    sortColumn,
    sortDir,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      applyView({ ...currentView, search: filterSearch });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [applyView, currentView, filterSearch]);

  const applyAdvancedFilters = useCallback(() => {
    applyView({
      ...currentView,
      ownerUserId: draftOwnerUserId,
      clientId: draftClientId,
      cups: draftCups,
      status: draftStatus,
      type: draftType,
      createdFrom: draftCreatedFrom,
      createdTo: draftCreatedTo,
      expiresFrom: draftExpiresFrom,
      expiresTo: draftExpiresTo,
      sortColumn: draftSortColumn,
      sortDir: draftSortDir,
    });
    setFiltersAnchorEl(null);
  }, [
    applyView,
    currentView,
    draftClientId,
    draftCreatedFrom,
    draftCreatedTo,
    draftCups,
    draftExpiresFrom,
    draftExpiresTo,
    draftOwnerUserId,
    draftSortColumn,
    draftSortDir,
    draftStatus,
    draftType,
  ]);

  const clearAdvancedFilters = useCallback(() => {
    const resetOwnerUserId = session.user.role === "COMMERCIAL" ? session.user.id : "";
    setDraftOwnerUserId(resetOwnerUserId);
    setDraftClientId("");
    setDraftCups("");
    setDraftStatus("");
    setDraftType("");
    setDraftCreatedFrom("");
    setDraftCreatedTo("");
    setDraftExpiresFrom("");
    setDraftExpiresTo("");
    setDraftSortColumn(DEFAULT_SORT_COLUMN);
    setDraftSortDir(DEFAULT_SORT_DIR);
    applyView({
      search: filterSearch,
      ownerUserId: resetOwnerUserId,
      clientId: "",
      cups: "",
      status: "",
      type: "",
      createdFrom: "",
      createdTo: "",
      expiresFrom: "",
      expiresTo: "",
      showArchived,
      sortColumn: DEFAULT_SORT_COLUMN,
      sortDir: DEFAULT_SORT_DIR,
    });
    setFiltersAnchorEl(null);
  }, [applyView, filterSearch, session.user.id, session.user.role, showArchived]);

  const columns = useMemo<ColumnDef<SimulationItem>[]>(() => [
    {
      key: "type",
      label: t("columns", "type"),
      width: "55px",
      renderCell: (s) => {
        const payload = s.payloadJson as { type?: string } | null;
        const type = payload?.type;
        const electricityLabel = t("simulationForm", "electricityLabel").trim() || "Electricity";
        const gasLabel = t("simulationForm", "gasLabel").trim() || "Gas";
        const electricityIconStyle = {
          fontSize: 20,
          color: "#f59e0b",
          opacity: s.isDeleted ? 0.5 : 1,
        };
        const gasIconStyle = {
          fontSize: 20,
          color: "#ef4444",
          opacity: s.isDeleted ? 0.5 : 1,
        };

        return (
          <Box
            component="span"
            title={
              type === "ELECTRICITY"
                ? electricityLabel
                : type === "GAS"
                  ? gasLabel
                  : type === "BOTH"
                    ? `${electricityLabel} + ${gasLabel}`
                    : undefined
            }
            aria-label={
              type === "ELECTRICITY"
                ? electricityLabel
                : type === "GAS"
                  ? gasLabel
                  : type === "BOTH"
                    ? `${electricityLabel} + ${gasLabel}`
                    : undefined
            }
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "flex-start",
              minWidth: 44,
            }}
          >
            {type === "ELECTRICITY" && <BoltIcon sx={electricityIconStyle} />}
            {type === "GAS" && <LocalFireDepartmentIcon sx={gasIconStyle} />}
            {type === "BOTH" && (
              <>
                <BoltIcon sx={electricityIconStyle} />
                <LocalFireDepartmentIcon sx={{ ...gasIconStyle, ml: "-4px" }} />
              </>
            )}
            {!type && <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-600)" }}>—</Typography>}
          </Box>
        );
      },
    },
    {
      key: "referenceNumber",
      label: t("columns", "reference"),
      width: "120",
      copyable: true,
      sortable: true,
      renderCell: (s) => (
        <Typography variant="body2" className="dt-cell-mono" sx={{ fontSize: '5px', opacity: s.isDeleted ? 0.4 : 1, color: "var(--scheme-neutral-300)" }}>
          {s.referenceNumber ?? <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-600)" }}>—</Typography>}
        </Typography>
      ),
    },
    {
      key: "owner",
      label: t("columns", "owner"),
      width: "150",
      copyable: true,
      copyText: (s) => s.ownerUser?.fullName ?? '',
      sortable: true,
      renderCell: (s) => (
        <Typography variant="body2" className="dt-cell-primary" sx={{ opacity: s.isDeleted ? 0.5 : 1 }}>
          {s.ownerUser?.fullName ?? "—"}
        </Typography>
      ),
    },
    {
      key: "client",
      label: t("columns", "client"),
      width: "200",
      copyable: true,
      copyText: (s) => s.client?.name ?? '',
      sortable: true,
      renderCell: (s) => {
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: s.isDeleted ? 0.5 : 1 }}>
            <Typography variant="body2" className="dt-cell-primary" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.client?.name
                ? <Box
                  component={'a'}
                  href={`/internal/clients/${s.client.id}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: "primary.main", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.client.name}
                </Box>
                : <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-500)", fontStyle: "italic" }}>{t("status", "noClient")}</Typography>
              }
            </Typography>
          </Box>
        );
      },
    },
    {
      key: "cups",
      label: t("columns", "cups"),
      copyable: true,
      copyText: (s: any) => {
        const payload = s.payloadJson as { electricity?: { clientData?: { cups?: string } }; gas?: { clientData?: { cups?: string } } } | null;
        const cupsElec = payload?.electricity?.clientData?.cups;
        const cupsGas = payload?.gas?.clientData?.cups;
        return s.cupsNumber || cupsElec || cupsGas || s?.invoiceData?.cups || '';
      },
      renderCell: (s) => {
        const payload = s.payloadJson as { electricity?: { clientData?: { cups?: string } }; gas?: { clientData?: { cups?: string } } } | null;
        const cupsElec = payload?.electricity?.clientData?.cups;
        const cupsGas = payload?.gas?.clientData?.cups;
        const cups = s.cupsNumber || cupsElec || cupsGas;

        return (
          <Typography variant="body2" className="dt-cell-mono" sx={{ opacity: s.isDeleted ? 0.5 : 1, whiteSpace: "nowrap" }}>
            {cups ? (
              <Typography component="span" variant="body2" sx={{ display: 'block' }}>
                {cupsElec && <Typography component="span" variant="body2" sx={{ display: "block" }}>{cupsElec}</Typography>}
                {cupsGas && cupsElec && <Typography component="span" variant="body2" sx={{ display: "block", opacity: 0.7 }}>{cupsGas}</Typography>}
                {!cupsElec && cupsGas && <Typography component="span" variant="body2" sx={{ display: "block" }}>{cupsGas}</Typography>}
              </Typography>
            ) : (
              <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-600)" }}>—</Typography>
            )}
          </Typography>
        );
      },
    },
    {
      key: "status",
      label: t("columns", "status"),
      sortable: true,
      renderCell: (s) => (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <StatusBadge label={s.status} tone={simulationStatusTone(s.status)} />
          {s.status === "SHARED" && s.clientOpenedAt && (
            <StatusBadge label={t("simulationsModule", "clientViewed") || "Viewed"} tone="accent" />
          )}
        </Box>
      ),
    },
    // {
    //   key: "pinSnapshot",
    //   label: "PIN",
    //   width: "70",
    //   sortable: true,
    //   renderCell: (s) => (
    //     <span className="dt-cell-mono" style={{letterSpacing: "0.12em", opacity: s.isDeleted ? 0.4 : 1 }}>
    //       {s.pinSnapshot ?? <span style={{ color: "var(--scheme-neutral-600)" }}>—</span>}
    //     </span>
    //   ),
    // },
    {
      key: "expiresAt",
      label: t("columns", "expires"),
      sortable: true,
      renderCell: (s) => (
        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
          {formatDateTime(s.expiresAt)}
        </Typography>
      ),
    },
    {
      key: "createdAt",
      label: t("columns", "created"),
      sortable: true,
      renderCell: (s) => (
        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
          {formatDateTime(s.createdAt)}
          {" - "}
          <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-400)" }}>
            {s.ownerUser?.fullName || "—"}
          </Typography>
        </Typography>
      ),
    },
    {
      key: "updatedAt",
      label: t("columns", "updated"),
      sortable: true,
      renderCell: (s) => (
        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
          {formatDateTime(s.updatedAt)}
          {" - "}
          <Typography component="span" variant="body2" sx={{ color: "var(--scheme-neutral-400)" }}>
            {s.ownerUser?.fullName || "—"}
          </Typography>
        </Typography>
      ),
    },
    {
      key: "actions",
      label: t("columns", "actions"),
      renderCell: (s) => {
        const { primaryLabel, primaryIcon, primaryOnClick, secondaryItems } = getSimulationActions(s);

        const hasDropdown = secondaryItems.length > 0;

        return (
          <div style={{ display: "flex", justifyContent: "flex-end", width: '100%' }}>
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={primaryOnClick}
                startIcon={primaryIcon}
                title={primaryLabel}
                aria-label={primaryLabel}
                sx={{
                  minWidth: "108px !important",
                  whiteSpace: "nowrap",
                }}
              >
                {primaryLabel}
              </Button>
              {hasDropdown && (
                <Button
                  size="small"
                  onClick={(e) => setDropdownState({ anchorEl: e.currentTarget, items: secondaryItems })}
                  aria-label="More actions"
                  sx={{ px: 0.5, minWidth: 32 }}
                >
                  <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                </Button>
              )}
            </ButtonGroup>
          </div>
        );
      },
    },
  ], [
    formatDateTime,
    getSimulationActions,
    router,
    session.user.role,
    t,
  ]);

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <DataTable<SimulationItem>
        tableId="simulations"
        columns={columns}
        rows={displayData}
        loading={loading}
        searchValue={filterSearch}
        onSearch={(v) => { setFilterSearch(v); }}
        onClearFilters={clearFilters}
        searchPlaceholder={t("search", "simulations")}
        emptyMessage={t("search", "emptySimulations")}
        hasActiveFilters={Boolean(filterSearch || activeAdvancedFilterCount)}
        showFilterSubmitActions={false}
        showFilterLabel={false}
        headerRight={(
          <Tooltip title={t("simulationsModule", "filtersTitle")}>
            <Badge
              color="primary"
              badgeContent={activeAdvancedFilterCount || undefined}
              variant={activeAdvancedFilterCount ? "standard" : "dot"}
              invisible={!activeAdvancedFilterCount}
            >
              <IconButton
                size="small"
                onClick={(event) => setFiltersAnchorEl(event.currentTarget)}
                aria-label={t("simulationsModule", "filtersTitle")}
              >
                <FilterListIcon fontSize="small" color="primary" />
              </IconButton>
            </Badge>
          </Tooltip>
        )}
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
        t={t}
        renderCustomSearch={({ draft, setDraft, commitSearch, searchPlaceholder }) => (
          <>
            <Box sx={{ flex: '0 1 220px', minWidth: 170, maxWidth: 240 }}>
              <TextField
                select
                size="small"
                label={t("simulationsModule", "viewPresetLabel")}
                value={activeViewPresetId ?? CUSTOM_VIEW_OPTION}
                onChange={(event) => {
                  const preset = viewPresets.find((view) => view.id === event.target.value);
                  if (preset) applyView(preset.view);
                }}
                sx={{
                  width: "100%",
                  "& .MuiSelect-select": {
                    py: 1,
                    fontWeight: 600,
                  },
                }}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (value) => {
                    if (value === CUSTOM_VIEW_OPTION) return t("simulationsModule", "customView");
                    return viewPresets.find((view) => view.id === value)?.name ?? t("simulationsModule", "viewPresetLabel");
                  },
                }}
              >
                <MenuItem value={CUSTOM_VIEW_OPTION} disabled>
                  {t("simulationsModule", "customView")}
                </MenuItem>
                {viewPresets.filter((view) => view.kind === "default").map((view) => (
                  <MenuItem key={view.id} value={view.id}>
                    {view.name}
                  </MenuItem>
                ))}
                {savedViews.length > 0 && (
                  <MenuItem disabled sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>
                    {t("simulationsModule", "savedViewsGroup")}
                  </MenuItem>
                )}
                {viewPresets.filter((view) => view.kind === "saved").map((view) => (
                  <MenuItem key={view.id} value={view.id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0 }}>
                      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {view.name}
                      </Box>
                      <IconButton
                        size="small"
                        aria-label={t("simulationsModule", "deleteSavedView")}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          deleteSavedView(view.id);
                        }}
                        sx={{ ml: "auto", p: 0.25 }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ flex: '0 1 380px', minWidth: 220, maxWidth: 420 }}>
              <FormInput
                label=""
                placeholder={searchPlaceholder}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setFilterSearch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitSearch();
                    applyView({ ...currentView, search: draft });
                  }
                }}
                size="small"
                slotProps={{
                  input: {
                    endAdornment: draft ? (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setDraft("");
                          setFilterSearch("");
                          applyView({ ...currentView, search: "" });
                        }}
                        aria-label="Clear"
                        edge="end"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null,
                  },
                }}
              />
            </Box>
          </>
        )}
        mobileCard={{
          title: "referenceNumber",
          status: "status",
          icon: (sim) => {
            const type = getSimulationType(sim);
            return type === "GAS"
              ? <LocalFireDepartmentIcon sx={{ fontSize: 20, color: "#ef4444" }} />
              : <BoltIcon sx={{ fontSize: 20, color: "#f59e0b" }} />;
          },
          fields: [
            {
              key: "owner",
              label: t("columns", "owner"),
              render: (sim) => `${sim.ownerUser?.fullName ?? "—"}${sim.agency?.name ? ` - ${sim.agency.name}` : ""}`,
            },
            "client",
            "cups",
            {
              key: "updatedAt",
              label: "Date",
              render: (sim) => formatDateTime(sim.updatedAt ?? sim.createdAt),
            },
          ],
          actions: (sim) => {
            const { primaryLabel, primaryIcon, primaryOnClick, secondaryItems } = getSimulationActions(sim);
            const actionCount = 1 + secondaryItems.length;

            return (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: actionCount > 2 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${actionCount}, minmax(0, 1fr))`,
                  gap: 0.75,
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={primaryOnClick}
                  startIcon={primaryIcon}
                  sx={{ minWidth: 0, whiteSpace: "normal", lineHeight: 1.15 }}
                >
                  {primaryLabel}
                </Button>
                {secondaryItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="outlined"
                    color={item.danger ? "error" : item.warning ? "warning" : "primary"}
                    size="small"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    startIcon={item.icon}
                    sx={{ minWidth: 0, whiteSpace: "normal", lineHeight: 1.15 }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>
            );
          },
        }}
        massActions={[
          {
            label: t("actions", "delete"),
            color: "error",
            icon: <DeleteIcon />,
            onClick: (ids) => setConfirmBulkDeleteIds(ids),
          },
        ]}
      />

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersAnchorEl(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            width: 760,
            maxWidth: "calc(100vw - 32px)",
            borderRadius: 2,
            boxShadow: "var(--scheme-shadow-strong)",
          },
        }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t("simulationsModule", "filtersTitle")}
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setSaveViewName("");
                setSaveViewOpen(true);
              }}
              sx={{ minWidth: 0 }}
            >
              {t("simulationsModule", "saveView")}
            </Button>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 1.5,
              alignItems: "start",
            }}
          >
            {session.user.role !== "COMMERCIAL" && (
              <FormSelect
                label={t("simulationsModule", "ownerFilter")}
                options={ownerOptions}
                value={draftOwnerUserId}
                onChange={(val) => setDraftOwnerUserId((val as string) ?? "")}
                textFieldProps={{ size: "small" }}
              />
            )}
            <FormSelect
              label={t("simulationsModule", "clientFilter")}
              options={clientOptions}
              value={draftClientId}
              onChange={(val) => setDraftClientId((val as string) ?? "")}
              textFieldProps={{ size: "small" }}
            />
            <FormSelect
              label={t("simulationsModule", "statusFilter")}
              options={[
                { value: "", label: t("search", "allStatuses") },
                { value: "DRAFT", label: "DRAFT" },
                { value: "SHARED", label: "SHARED" },
                { value: "EXPIRED", label: "EXPIRED" },
              ]}
              value={draftStatus}
              onChange={(val) => setDraftStatus((val as string) ?? "")}
              textFieldProps={{ size: "small" }}
            />
            <FormSelect
              label={t("simulationsModule", "typeFilter")}
              options={[
                { value: "", label: t("simulationsModule", "allTypes") },
                { value: "ELECTRICITY", label: t("simulationsModule", "typeElectricity") },
                { value: "GAS", label: t("simulationsModule", "typeGas") },
                { value: "BOTH", label: t("simulationsModule", "typeBoth") },
              ]}
              value={draftType}
              onChange={(val) => setDraftType((val as string) ?? "")}
              textFieldProps={{ size: "small" }}
            />
            <FormInput
              label={t("simulationsModule", "cupsFilter")}
              value={draftCups}
              onChange={(event) => setDraftCups(event.target.value)}
              size="small"
            />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              <DateInput
                label={t("simulationsModule", "createdFrom")}
                labelPosition="top"
                value={draftCreatedFrom}
                onChange={setDraftCreatedFrom}
              />
              <DateInput
                label={t("simulationsModule", "createdTo")}
                labelPosition="top"
                value={draftCreatedTo}
                onChange={setDraftCreatedTo}
              />
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              <DateInput
                label={t("simulationsModule", "expiresFrom")}
                labelPosition="top"
                value={draftExpiresFrom}
                onChange={setDraftExpiresFrom}
              />
              <DateInput
                label={t("simulationsModule", "expiresTo")}
                labelPosition="top"
                value={draftExpiresTo}
                onChange={setDraftExpiresTo}
              />
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              <FormSelect
                label={t("simulationsModule", "sortBy")}
                options={[
                  { value: "updatedAt", label: t("simulationsModule", "sortUpdated") },
                  { value: "createdAt", label: t("simulationsModule", "sortCreated") },
                  { value: "expiresAt", label: t("simulationsModule", "sortExpires") },
                  { value: "referenceNumber", label: t("simulationsModule", "sortReference") },
                  { value: "status", label: t("simulationsModule", "sortStatus") },
                ]}
                value={draftSortColumn}
                onChange={(val) => setDraftSortColumn((val as string) || DEFAULT_SORT_COLUMN)}
                textFieldProps={{ size: "small" }}
              />
              <FormSelect
                label={t("simulationsModule", "sortDirection")}
                options={[
                  { value: "desc", label: t("simulationsModule", "directionDescending") },
                  { value: "asc", label: t("simulationsModule", "directionAscending") },
                ]}
                value={draftSortDir}
                onChange={(val) => setDraftSortDir(val === "asc" ? "asc" : "desc")}
                textFieldProps={{ size: "small" }}
              />
            </Box>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button size="small" variant="text" onClick={clearAdvancedFilters}>
              {t("simulationsModule", "clearFilters")}
            </Button>
            <Button size="small" variant="contained" onClick={applyAdvancedFilters}>
              {t("simulationsModule", "applyFilters")}
            </Button>
          </Box>
        </Stack>
      </Dialog>

      <Dialog open={saveViewOpen} onClose={() => setSaveViewOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("simulationsModule", "saveViewTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("simulationsModule", "saveViewDescription")}
            </Typography>
            <TextField
              autoFocus
              label={t("simulationsModule", "viewName")}
              value={saveViewName}
              onChange={(event) => setSaveViewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveCurrentView();
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveViewOpen(false)}>{t("simulationsModule", "cancel")}</Button>
          <Button variant="contained" onClick={saveCurrentView} disabled={!saveViewName.trim()}>
            {t("simulationsModule", "save")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit payload panel ── */}
      <SlidePanel
        open={!!selectedSimulationId}
        onClose={closeSimulationEditor}
        title={t("simulationsModule", "editPayloadTitle")}
        subtitle={selectedSimulationId ? `ID: ${selectedSimulationId.slice(0, 12)}…` : undefined}
        width={600}
        footer={
          <>
            <button className="sp-btn-secondary" onClick={() => { closeSimulationEditor(); clearFeedback(); }}>{t("actions", "cancel")}</button>
            <button
              className="sp-btn-primary"
              disabled={busyAction === "update-simulation"}
              onClick={(e) => handleUpdateSimulation(e as unknown as React.FormEvent)}
            >
              {busyAction === "update-simulation" ? t("actions", "saving") : t("actions", "saveChanges")}
            </button>
          </>
        }
      >
        {errorText && <div className="sp-panel-error">{errorText}</div>}
        <div className="sp-form-group" style={{ flex: 1 }}>
          <label className="sp-form-label">{t("simulationsModule", "payloadJson")}</label>
          <textarea
            className="sp-form-textarea"
            style={{ minHeight: 360, fontFamily: "monospace", }}
            value={editPayloadJson}
            onChange={(e) => setEditPayloadJson(e.target.value)}
          />
        </div>
      </SlidePanel>

      {/* ── Share popup ── */}
      <Dialog
        open={!!shareSim}
        onClose={() => setShareSim(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {t("simulationDetail", "shareTitle") || t("actions", "share")}
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setShareSim(null)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 0 }}>
          {shareModalLoading ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">{t("common", "loading") || "Loading..."}</Typography>
            </Box>
          ) : shareSim ? (
            <ShareSimulationView
              simulation={shareSim}
              token={session.token}
              isTestingMode={false}
              loggedUserEmail={session.user.email}
              onSuccess={(msg) => {
                onNotify?.(msg, "success");
                setShareSim(null);
                refresh();
              }}
              onError={(msg) => onNotify?.(msg, "error")}
              onStatusChange={() => {
                refresh();
                setShareSim(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {confirmDeleteSim && (
        <ConfirmDialog
          title={t("simulationsModule", "deleteTitle")}
          message={t(
            "simulationsModule",
            confirmDeleteSim.isDeleted ? "deletePermanentConfirm" : "deleteConfirm",
            { id: getSimulationReference(confirmDeleteSim) },
          )}
          confirmLabel={t("actions", "delete")}
          countdownSeconds={confirmDeleteSim.isDeleted ? 5 : undefined}
          busy={busyAction === `delete-${confirmDeleteSim.id}`}
          onConfirm={async () => {
            await handleArchive(confirmDeleteSim);
            setConfirmDeleteSim(null);
          }}
          onCancel={() => setConfirmDeleteSim(null)}
        />
      )}

      {confirmBulkDeleteIds && (
        <ConfirmDialog
          title={t("simulationsModule", "bulkDeleteTitle")}
          message={t(
            "simulationsModule",
            bulkDeleteIncludesArchived ? "bulkDeletePermanentConfirm" : "bulkDeleteConfirm",
            { count: confirmBulkDeleteIds.length },
          )}
          confirmLabel={t("simulationsModule", "bulkDeleteConfirmLabel")}
          countdownSeconds={bulkDeleteIncludesArchived ? 5 : undefined}
          busy={busyAction === "bulk-delete"}
          onConfirm={async () => {
            await handleBulkDelete(confirmBulkDeleteIds);
            setConfirmBulkDeleteIds(null);
          }}
          onCancel={() => setConfirmBulkDeleteIds(null)}
        />
      )}

      {/* ── Actions dropdown menu ── */}
      <Menu
        open={!!dropdownState.anchorEl}
        anchorEl={dropdownState.anchorEl}
        onClose={closeDropdown}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 150,
              borderRadius: "8px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            },
          },
        }}
      >
        {dropdownState.items.map((item, i) => (
          <MenuItem
            key={i}
            onClick={() => { item.onClick(); closeDropdown(); }}
            disabled={item.disabled}
            sx={{color: item.danger ? "error.main" : item.warning ? "warning.main" : "text.primary",
              py: 0.75,
              gap: 1,
            }}
          >
            {item.icon && (
              <Box component="span" sx={{ display: "inline-flex", width: 18, color: "inherit" }}>
                {item.icon}
              </Box>
            )}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
