"use client";

import { DataGrid, useGridApiRef, type GridColDef, type GridSortModel } from "@mui/x-data-grid";
import { Box, IconButton, Skeleton, Pagination, Select, MenuItem, FormControl, Checkbox, Button, Tooltip, useTheme, Popover, FormControlLabel, Divider, Typography, Drawer, useMediaQuery, Grow } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserPreferences } from "../providers/UserPreferencesProvider";
import { useI18n } from "../../../../src/lib/i18n-context";
import ClearIcon from '@mui/icons-material/Clear';
// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  renderCell: (row: T) => React.ReactNode;
  /** If true, a copy button appears on hover to copy the cell's text content */
  copyable?: boolean;
  /** Provide a custom text extractor for copying. Required when the cell renders JSX
   *  whose text cannot be derived from the raw row field (e.g. nested objects). */
  copyText?: (row: T) => string;
  width?: string;
}

export interface SortState {
  column: string;
  direction: "asc" | "desc";
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export interface MassAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedIds: string[]) => void;
  color?: "inherit" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
}

type MobileCardField<T> = string | {
  key: string;
  label?: string;
  render?: (row: T) => React.ReactNode;
};

export interface MobileCardConfig<T> {
  title?: string | ((row: T) => React.ReactNode);
  status?: string | ((row: T) => React.ReactNode);
  icon?: (row: T) => React.ReactNode;
  fields?: MobileCardField<T>[];
  actions?: string | ((row: T) => React.ReactNode);
}

export interface DataTableProps<T extends { id: string }> {
  /** Used to persist column visibility in localStorage. Should be unique per table. */
  tableId?: string;
  columns: ColumnDef<T>[];
  rows: T[];
  loading?: boolean;
  error?: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
  onApplyFilters?: (draft: string) => void;
  onClearFilters?: () => void;
  /** When false the Clear button is hidden even if onClearFilters is provided. Defaults to true. */
  hasActiveFilters?: boolean;
  searchPlaceholder?: string;
  sortState?: SortState;
  onSort?: (column: string) => void;
  toolbarLeft?: React.ReactNode;
  renderCustomSearch?: (params: {
    draft: string;
    setDraft: (value: string) => void;
    commitSearch: () => void;
    searchPlaceholder: string;
    mode: "desktop" | "mobile";
  }) => React.ReactNode;
  filterBar?: React.ReactNode;
  pagination?: PaginationState;
  rowActions?: (row: T) => React.ReactNode;
  headerRight?: React.ReactNode;
  footerLeft?: React.ReactNode;
  emptyMessage?: string;
  t?: (namespace: any, key: string) => string;
  massActions?: MassAction[];
  /** Mobile cards are enabled by default so every table gets a readable phone layout. */
  enableMobileCards?: boolean;
  mobileCard?: MobileCardConfig<T>;
  /** Escape hatch for screens that need a fully custom card. Prefer mobileCard when possible. */
  renderMobileCard?: (row: T) => React.ReactNode;
}

const BASE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Stable cell component so MUI DataGrid doesn't re-mount it on every render.
function CheckboxCell({
  id,
  selectedIdsRef,
  toggleRow,
}: {
  id: string;
  selectedIdsRef: React.RefObject<Set<string>>;
  toggleRow: (id: string) => void;
}) {
  return (
    <Checkbox
      size="small"
      checked={selectedIdsRef.current?.has(id) ?? false}
      onChange={() => toggleRow(id)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

// Copyable cell wrapper – shows a copy button on hover
function CopyableCell({ children, text }: { children: React.ReactNode; text: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { t } = useI18n();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        position: 'relative',
        pr: hovered ? '26px' : 0,
        transition: 'padding-right 0.1s',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {children}
      </Box>
      {hovered && (
        <Tooltip title={copied ? t('dataTable', 'copied') : t('dataTable', 'copy')} placement="top">
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{
              position: 'absolute',
              right: 0,
              '&:hover': { color: copied ? 'success.main' : 'var(--scheme-neutral-100)' },
            }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ── Column visibility helpers ────────────────────────────────────────────────
function loadHiddenCols(tableId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`axpo_dt_hidden_cols_${tableId}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function saveHiddenCols(tableId: string, hidden: Set<string>) {
  try {
    localStorage.setItem(`axpo_dt_hidden_cols_${tableId}`, JSON.stringify([...hidden]));
  } catch { /* ignore */ }
}

// ── Filter & Sort Persistence helpers ────────────────────────────────────────
interface TablePersistentState {
  search: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  pageSize?: number;
}

function loadTableState(tableId: string): TablePersistentState | null {
  if (typeof window === 'undefined' || !tableId) return null;
  try {
    const raw = localStorage.getItem(`axpo_dt_state_${tableId}`);
    if (!raw) return null;
    return JSON.parse(raw) as TablePersistentState;
  } catch { return null; }
}

function saveTableState(tableId: string, state: TablePersistentState) {
  if (!tableId) return;
  try {
    localStorage.setItem(`axpo_dt_state_${tableId}`, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  tableId,
  columns,
  rows,
  loading = false,
  error,
  searchValue = "",
  onSearch,
  onApplyFilters,
  onClearFilters,
  hasActiveFilters = true,
  searchPlaceholder = "Search…",
  sortState,
  onSort,
  toolbarLeft,
  renderCustomSearch,
  filterBar,
  pagination,
  rowActions,
  headerRight,
  footerLeft,
  emptyMessage = "No records found.",
  t,
  massActions,
  enableMobileCards = true,
  mobileCard,
  renderMobileCard,
}: DataTableProps<T>) {
  const { preferences } = useUserPreferences();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const apiRef = useGridApiRef();
  const { t: tI18n } = useI18n();

  // ── Column visibility ───────────────────────────────────────────────────────
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() =>
    tableId ? loadHiddenCols(tableId) : new Set()
  );
  const [colMenuAnchor, setColMenuAnchor] = useState<HTMLElement | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileColumnsOpen, setMobileColumnsOpen] = useState(false);

  const toggleColVisibility = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      if (tableId) saveHiddenCols(tableId, next);
      return next;
    });
  };

  const showAllCols = () => {
    setHiddenCols(new Set());
    if (tableId) saveHiddenCols(tableId, new Set());
  };

  // ── Persistent state loading ────────────────────────────────────────────────
  // Load persisted state once on mount
  const persistedState = useMemo(() => tableId ? loadTableState(tableId) : null, [tableId]);

  // Initialize with persisted state or defaults
  const initialSearch = searchValue || persistedState?.search || "";
  const initialSortColumn = sortState?.column || persistedState?.sortColumn || "";
  const initialSortDir = sortState?.direction || persistedState?.sortDirection || "asc";

  // Helper to save scroll position before a selection state update and restore it after.
  const withScrollPreserved = useCallback((fn: () => void) => {
    const pos = apiRef.current?.getScrollPosition?.();
    fn();
    if (pos) {
      requestAnimationFrame(() => {
        apiRef.current?.scroll?.(pos);
      });
    }
  }, [apiRef]);

  // Row selection state (only active when massActions provided)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hasMassActions = Boolean(massActions && massActions.length > 0);

  // Refs so that renderCell callbacks always read latest values without
  // being listed as memo dependencies (avoids DataGrid re-mount on selection).
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const visibleRowIds = useMemo(
    () => (loading ? [] : rows.map((r) => r.id)),
    [loading, rows]
  );
  const visibleRowIdsKey = visibleRowIds.join("\u0000");

  const allSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id));
  const someSelected = visibleRowIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    withScrollPreserved(() => {
      if (allSelectedRef.current) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(visibleRowIds));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withScrollPreserved, visibleRowIds]);

  const toggleRow = useCallback((id: string) => {
    withScrollPreserved(() => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    });
  }, [withScrollPreserved]);

  const allSelectedRef = useRef(allSelected);
  allSelectedRef.current = allSelected;
  const someSelectedRef = useRef(someSelected);
  someSelectedRef.current = someSelected;
  const toggleSelectAllRef = useRef(toggleSelectAll);
  toggleSelectAllRef.current = toggleSelectAll;

  const getRowClassName = useCallback(
    (params: import("@mui/x-data-grid").GridRowClassNameParams) =>
      hasMassActions && selectedIdsRef.current.has(params.row.id) ? 'dt-row-selected' : '',
    // hasMassActions is stable after mount; selectedIdsRef is always current
    [hasMassActions]
  );

  // Clear selection when rows change (e.g. page change)
  useEffect(() => {
    setSelectedIds((current) => current.size > 0 ? new Set() : current);
  }, [visibleRowIdsKey]);

  // Build page size options, ensuring the user's preferred size is always included
  const PAGE_SIZE_OPTIONS = useMemo(() => {
    const preferred = preferences.itemsPerPage;
    const opts = BASE_PAGE_SIZE_OPTIONS.includes(preferred)
      ? BASE_PAGE_SIZE_OPTIONS
      : [...BASE_PAGE_SIZE_OPTIONS, preferred].sort((a, b) => a - b);
    return opts;
  }, [preferences.itemsPerPage]);

  // Convert custom ColumnDef to MUI GridColDef
  const muiColumns: GridColDef<T>[] = useMemo(() => {
    const cols: GridColDef<T>[] = [];

    // Checkbox column
    if (hasMassActions) {
      cols.push({
        field: "__select",
        headerName: "",
        sortable: false,
        width: 52,
        renderHeader: () => (
          <Checkbox
            size="small"
            checked={allSelectedRef.current}
            indeterminate={!allSelectedRef.current && someSelectedRef.current}
            onChange={() => toggleSelectAllRef.current()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        renderCell: (params: import("@mui/x-data-grid").GridRenderCellParams<T>) => {
          return (
            <CheckboxCell
              id={params.row.id}
              selectedIdsRef={selectedIdsRef}
              toggleRow={toggleRow}
            />
          );
        },
      } as GridColDef<T>);
    }

    columns.filter((col) => !hiddenCols.has(col.key)).forEach((col) => {
      const isActionsColumn = col.key === "actions";
      const explicitWidth = col.width ? parseInt(col.width) : undefined;

      cols.push({
        field: col.key,
        headerName: col.label,
        sortable: col.sortable ?? false,
        width: explicitWidth ?? (isActionsColumn ? 180 : undefined),
        minWidth: isActionsColumn ? 164 : undefined,
        maxWidth: isActionsColumn && !explicitWidth ? 220 : undefined,
        flex: !col.width && !isActionsColumn ? 1 : undefined,
        align: isActionsColumn ? "right" : undefined,
        headerAlign: isActionsColumn ? "right" : undefined,
        cellClassName: isActionsColumn ? "dt-grid-cell-actions" : undefined,
        renderCell: (params) => {
          // Show skeleton when loading
          if (loading && (params.row as any).__skeleton) {
            return <Skeleton variant="rounded" width="100%" height={'50%'} />;
          }
          const content = col.renderCell(params.row);
          const cellContent = isActionsColumn ? content : (
            <Typography
              component="div"
              variant="body2"
              className="dt-grid-cell-content"
              sx={{
                minWidth: 0,
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {content}
            </Typography>
          );
          if (col.copyable) {
            // Use explicit copyText extractor when provided, otherwise try params.value
            // (params.value reflects row[col.key] which may be an object or undefined)
            let cellValue: string;
            if (col.copyText) {
              cellValue = col.copyText(params.row);
            } else {
              const raw = params.value;
              cellValue = (raw != null && typeof raw !== 'object') ? String(raw) : '';
            }
            return <CopyableCell text={cellValue}>{cellContent}</CopyableCell>;
          }
          return cellContent;
        },
      } as GridColDef<T>);
    });

    // Add actions column if rowActions provided
    if (rowActions) {
      cols.push({
        field: "actions",
        headerName: tI18n('common', 'actions'),
        sortable: false,
        width: 200,
        renderCell: (params) => {
          if (loading && (params.row as any).__skeleton) {
            return (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton width={50} height={26} variant="rounded" />
                <Skeleton width={80} height={26} variant="rounded" />
                <Skeleton width={80} height={26} variant="rounded" />
              </Box>
            );
          }
          return rowActions(params.row);
        },
      });
    }

    return cols;
    // NOTE: selectedIds/toggleRow/toggleSelectAll are intentionally omitted – they
    // are accessed via refs inside renderCell to prevent the grid from re-mounting
    // (and scrolling to top) on every checkbox click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rowActions, loading, hasMassActions, hiddenCols, tI18n]);

  // Create skeleton rows when loading
  const skeletonRows = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `skeleton-${i}`,
      __skeleton: true,
    } as any));
  }, []);

  // Use skeleton rows when loading, otherwise use actual rows
  const displayRows = loading ? skeletonRows : rows;

  // Local draft for search — only committed on Enter or button click
  const [draft, setDraft] = useState(searchValue);

  // Sync draft if the parent resets searchValue (e.g. clearing from outside)
  useEffect(() => {
    setDraft(searchValue);
  }, [searchValue]);

  const commitSearch = () => {
    if (onSearch) onSearch(draft);
  };
  const applyFilterControls = () => {
    if (onApplyFilters) {
      onApplyFilters(draft);
      return;
    }
    commitSearch();
  };

  // ── Persist state to localStorage whenever search or sort changes ────────────
  useEffect(() => {
    if (!tableId) return;

    const currentState: TablePersistentState = {
      search: searchValue,
      sortColumn: sortState?.column,
      sortDirection: sortState?.direction,
      pageSize: pagination?.pageSize,
    };

    saveTableState(tableId, currentState);
  }, [tableId, searchValue, sortState?.column, sortState?.direction, pagination?.pageSize]);

  // Handle sort model changes
  const handleSortModelChange = (model: GridSortModel) => {
    if (onSort && model.length > 0) {
      onSort(model[0].field);
    }
  };

  const sortModel: GridSortModel = useMemo(() => sortState
    ? [{ field: sortState.column, sort: sortState.direction }]
    : [],
    [sortState?.column, sortState?.direction]); // eslint-disable-line react-hooks/exhaustive-deps

  const paginationModel = useMemo(() => ({
    pageSize: pagination?.pageSize || preferences.itemsPerPage,
    page: pagination ? pagination.page - 1 : 0,
  }), [pagination?.pageSize, pagination?.page, preferences.itemsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const canLoadMore = Boolean(pagination && pagination.pageSize < pagination.total);
  const visibleCount = pagination ? Math.min(pagination.pageSize, pagination.total) : rows.length;
  const useMobileCards = enableMobileCards;
  const shouldRenderGrid = !(useMobileCards && isMobile);
  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenCols.has(col.key)),
    [columns, hiddenCols]
  );
  const columnByKey = useMemo(
    () => new Map(columns.map((col) => [col.key, col])),
    [columns]
  );
  const mobileTitleKey = useMemo(() => {
    if (typeof mobileCard?.title === 'string' && !hiddenCols.has(mobileCard.title)) return mobileCard.title;
    return (
      visibleColumns.find((col) => ['referenceNumber', 'reference', 'name', 'fullName', 'email', 'title'].includes(col.key))?.key ||
      visibleColumns.find((col) => !['status', 'actions', 'type'].includes(col.key))?.key ||
      visibleColumns[0]?.key
    );
  }, [hiddenCols, mobileCard?.title, visibleColumns]);
  const mobileStatusKey = useMemo(() => {
    if (typeof mobileCard?.status === 'string') {
      return hiddenCols.has(mobileCard.status) ? undefined : mobileCard.status;
    }
    return visibleColumns.find((col) => col.key === 'status')?.key;
  }, [hiddenCols, mobileCard?.status, visibleColumns]);
  const mobileActionsKey = useMemo(() => {
    if (typeof mobileCard?.actions === 'string') {
      return hiddenCols.has(mobileCard.actions) ? undefined : mobileCard.actions;
    }
    return visibleColumns.find((col) => col.key === 'actions')?.key;
  }, [hiddenCols, mobileCard?.actions, visibleColumns]);
  const mobileFields = useMemo<MobileCardField<T>[]>(() => {
    const reservedKeys = new Set([mobileTitleKey, mobileStatusKey, mobileActionsKey, 'type'].filter(Boolean));
    if (mobileCard?.fields) {
      const fieldKeys = new Set(mobileCard.fields.map((field) => typeof field === 'string' ? field : field.key));
      const customVisibleFields = mobileCard.fields.filter((field) => {
        const key = typeof field === 'string' ? field : field.key;
        return visibleColumns.some((col) => col.key === key) && !reservedKeys.has(key);
      });
      const remainingVisibleFields = visibleColumns
        .filter((col) => !reservedKeys.has(col.key) && !fieldKeys.has(col.key))
        .map((col) => col.key);
      return [...customVisibleFields, ...remainingVisibleFields];
    }
    return visibleColumns
      .filter((col) => !reservedKeys.has(col.key))
      .map((col) => col.key);
  }, [mobileCard?.fields, mobileActionsKey, mobileStatusKey, mobileTitleKey, visibleColumns]);
  const renderMobileCell = useCallback((key: string, row: T) => {
    const col = columnByKey.get(key);
    return col ? col.renderCell(row) : null;
  }, [columnByKey]);
  const renderDefaultMobileCard = useCallback((row: T) => {
    const title = typeof mobileCard?.title === 'function'
      ? mobileCard.title(row)
      : mobileTitleKey
        ? renderMobileCell(mobileTitleKey, row)
        : row.id;
    const status = typeof mobileCard?.status === 'function'
      ? mobileCard.status(row)
      : mobileStatusKey
        ? renderMobileCell(mobileStatusKey, row)
        : null;
    const actions = typeof mobileCard?.actions === 'function'
      ? visibleColumns.some((col) => col.key === 'actions')
        ? mobileCard.actions(row)
        : null
      : mobileActionsKey
        ? renderMobileCell(mobileActionsKey, row)
        : rowActions?.(row);

    return (
      <Box
        data-mobile-datatable-card="true"
        sx={{
          border: '1px solid color-mix(in srgb, var(--scheme-neutral-900) 82%, var(--scheme-neutral-800))',
          borderRadius: '10px',
          backgroundColor: 'var(--scheme-neutral-1100)',
          boxShadow: 'var(--scheme-shadow-soft)',
          p: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {mobileCard?.icon && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                {mobileCard.icon(row)}
              </Box>
            )}
            <Typography variant="body2" component="div" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--scheme-neutral-100)', fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
          {status && (
            <Box sx={{ flexShrink: 0, display: 'inline-flex', justifyContent: 'flex-end' }}>
              {status}
            </Box>
          )}
        </Box>

        {mobileFields.length > 0 && (
          <Box sx={{ display: 'grid', gap: 0.65, color: 'var(--scheme-neutral-300)' }}>
            {mobileFields.map((field) => {
              const fieldKey = typeof field === 'string' ? field : field.key;
              const col = columnByKey.get(fieldKey);
              if (!col) return null;
              const content = typeof field === 'string'
                ? col.renderCell(row)
                : field.render
                  ? field.render(row)
                  : col.renderCell(row);
              return (
                <Box key={fieldKey} sx={{ display: 'flex', gap: 0.5, minWidth: 0 }}>
                  <Typography component="span" variant="caption" sx={{ color: 'var(--scheme-neutral-500)', flexShrink: 0 }}>
                    {typeof field === 'string' ? col.label : (field.label ?? col.label)}:
                  </Typography>
                  <Typography component="span" variant="body2" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', overflowWrap: 'anywhere' }}>
                    {content}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {actions && (
          <Box sx={{ mt: 1.5 }}>
            {actions}
          </Box>
        )}
      </Box>
    );
  }, [columnByKey, mobileActionsKey, mobileCard, mobileFields, mobileStatusKey, mobileTitleKey, renderMobileCell, rowActions]);

  const tableSurface = 'var(--scheme-surface-raised)';
  const tableHeaderBackground = 'color-mix(in srgb, var(--scheme-surface-raised) 84%, var(--scheme-surface-raised-subtle))';
  const tableHoverBackground = 'color-mix(in srgb, var(--scheme-brand-600) 5%, var(--scheme-surface-raised))';
  const tableSelectedBackground = theme.palette.mode === 'dark'
    ? theme.palette.primary.dark + '33'
    : theme.palette.primary.main + '20';
  const tableSelectedHoverBackground = theme.palette.mode === 'dark'
    ? theme.palette.primary.dark + '44'
    : theme.palette.primary.main + '30';

  return (
    <div className="dt-root" style={{ height: '100%', minHeight: 0 }}>
      {useMobileCards && (
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            flexDirection: 'column',
            gap: 1,
            p: 1,
            backgroundColor: tableHeaderBackground,
            borderBottom: '1px solid color-mix(in srgb, var(--scheme-neutral-900) 74%, transparent)',
          }}
        >
          {onSearch && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <div className="dt-search-wrap" style={{ flex: 1, minWidth: 0 }}>
                <input
                  className="dt-search"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
              </div>
              <Button
                variant="contained"
                size="small"
                onClick={commitSearch}
                aria-label="Search"
                startIcon={<SearchIcon fontSize="small" />}
                sx={{ height: 38, textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                {tI18n('common', 'search')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => { setDraft(""); if (onClearFilters) onClearFilters(); else if (onSearch) onSearch(""); }}
                aria-label={tI18n('dataTable', 'clearFilters')}
                startIcon={<ClearIcon fontSize="small" />}
                sx={{ height: 38, textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                {tI18n('dataTable', 'clearFilters')}
              </Button>
            </Box>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: renderCustomSearch ? '1fr 1fr' : '1fr', gap: 1 }}>
            {renderCustomSearch && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setMobileFiltersOpen(true)}
                sx={{ justifyContent: 'center' }}
              >
                <FilterListIcon fontSize="small" />
                {tI18n('dataTable', 'filters')}{hasActiveFilters ? ' *' : ''}
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={() => setMobileColumnsOpen(true)}
              sx={{ justifyContent: 'center' }}
            >
              <ViewColumnIcon fontSize="small" />
              {tI18n('dataTable', 'columnsTitle')}
            </Button>
          </Box>
          {!onSearch && toolbarLeft}
          {headerRight && <Box>{headerRight}</Box>}
        </Box>
      )}

      {/* Toolbar */}
      <Box className="dt-toolbar" sx={{ backgroundColor: tableHeaderBackground, display: { xs: useMobileCards ? 'none' : 'flex', md: 'flex' }, flexWrap: 'nowrap' }}>

        <div
          className="dt-toolbar-left"
          style={renderCustomSearch ? { flex: 1, minWidth: 0 } : undefined}
        >
          {renderCustomSearch ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', width: '100%', minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
              {renderCustomSearch({ draft, setDraft, commitSearch, searchPlaceholder, mode: "desktop" })}
              <Button
                size="small"
                variant="contained"
                onClick={applyFilterControls}
                startIcon={<SearchIcon fontSize="small" />}
                sx={{ height: 36, textTransform: 'none', whiteSpace: 'nowrap', display: { xs: useMobileCards ? 'none' : 'inline-flex', md: 'inline-flex' } }}
              >
                {tI18n('common', 'search')}
              </Button>
              {onClearFilters && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onClearFilters}
                  startIcon={<ClearIcon fontSize="small" />}
                  sx={{ height: 36, textTransform: 'none', whiteSpace: 'nowrap', display: { xs: useMobileCards ? 'none' : 'inline-flex', md: 'inline-flex' } }}
                >
                  {tI18n('dataTable', 'clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            toolbarLeft
          )}
        </div>

        {!renderCustomSearch && (
          <div className="dt-toolbar-center">
            {onSearch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="dt-search-wrap">
                  <input
                    className="dt-search"
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                  />
                </div>
                <Button
                  variant="contained"
                  size="small"
                  onClick={commitSearch}
                  aria-label="Search"
                  startIcon={<SearchIcon fontSize="small" />}
                  sx={{ height: 36, textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  {tI18n('common', 'search')}
                </Button>
                {onClearFilters && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setDraft("");
                      onClearFilters();
                    }}
                    startIcon={<ClearIcon fontSize="small" />}
                    sx={{ height: 36, textTransform: 'none', whiteSpace: 'nowrap' }}
                  >
                    {tI18n('dataTable', 'clearFilters')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        <div className="dt-toolbar-right">
          {onClearFilters && !onSearch && !renderCustomSearch && (
            <Button
              size="small"
              variant="outlined"
              onClick={onClearFilters}
              startIcon={<ClearIcon fontSize="small" />}
              sx={{ height: 36, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              {tI18n('dataTable', 'clearFilters')}
            </Button>
          )}
          {/* Column visibility toggle */}
          <Tooltip title={tI18n('dataTable', 'showHideColumns')}>
            <IconButton
              size="small"
              onClick={(e) => setColMenuAnchor(e.currentTarget)}
              sx={{ display: { xs: useMobileCards ? 'none' : 'inline-flex', md: 'inline-flex' } }}
            >
              <ViewColumnIcon fontSize="small" color="primary" />
            </IconButton>
          </Tooltip>
          {headerRight}
        </div>
      </Box>

      {/* Column visibility popover */}
      <Popover
        open={Boolean(colMenuAnchor)}
        anchorEl={colMenuAnchor}
        onClose={() => setColMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.5, minWidth: 200, maxHeight: 360, overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" fontWeight={600} sx={{ textTransform: 'uppercase', color: 'text.secondary' }}>
              {tI18n('dataTable', 'columnsTitle')}
            </Typography>
            {hiddenCols.size > 0 && (
              <Button size="small" variant="text" onClick={showAllCols} sx={{ py: 0, minWidth: 0 }}>
                {tI18n('dataTable', 'showAll')}
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />
          {columns.map((col) => (
            <Box key={col.key} sx={{ display: 'flex', alignItems: 'center', py: 0.25 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={!hiddenCols.has(col.key)}
                    onChange={() => toggleColVisibility(col.key)}
                  />
                }
                label={<Typography variant="body2">{col.label}</Typography>}
                sx={{ m: 0 }}
              />
            </Box>
          ))}
        </Box>
      </Popover>
      <Drawer
        anchor="bottom"
        open={mobileColumnsOpen}
        onClose={() => setMobileColumnsOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            backgroundColor: 'var(--scheme-neutral-1100)',
            color: 'var(--scheme-neutral-100)',
            maxHeight: '80vh',
            boxShadow: 'var(--scheme-shadow-strong)',
          },
        }}
      >
        <Box sx={{ p: 2, overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {tI18n('dataTable', 'visibleColumns')}
            </Typography>
            <IconButton size="small" onClick={() => setMobileColumnsOpen(false)} aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 1.25 }} />
          {columns.map((col) => (
            <Box key={col.key} sx={{ display: 'flex', alignItems: 'center', py: 0.25 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={!hiddenCols.has(col.key)}
                    onChange={() => toggleColVisibility(col.key)}
                  />
                }
                label={<Typography variant="body2">{col.label}</Typography>}
                sx={{ m: 0, width: '100%' }}
              />
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {hiddenCols.size > 0 && (
              <Button variant="outlined" size="small" onClick={showAllCols} sx={{ flex: 1 }}>
                {tI18n('dataTable', 'showAll')}
              </Button>
            )}
            <Button variant="contained" size="small" onClick={() => setMobileColumnsOpen(false)} sx={{ flex: 1 }}>
              {tI18n('dataTable', 'apply')}
            </Button>
          </Box>
        </Box>
      </Drawer>
      {renderCustomSearch && (
        <Drawer
          anchor="bottom"
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          PaperProps={{
            sx: {
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              backgroundColor: 'var(--scheme-neutral-1100)',
              color: 'var(--scheme-neutral-100)',
              maxHeight: '85vh',
              boxShadow: 'var(--scheme-shadow-strong)',
            },
          }}
        >
          <Box sx={{ p: 2, overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {tI18n('dataTable', 'filters')}
              </Typography>
              <IconButton size="small" onClick={() => setMobileFiltersOpen(false)} aria-label="Close">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Box
              className="dt-mobile-filter-fields"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                '& > *': {
                  width: '100% !important',
                  maxWidth: 'none !important',
                  minWidth: '0 !important',
                  flex: '0 0 auto !important',
                },
                '& > .MuiBox-root': {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 1.25,
                },
                '& > .MuiBox-root > *': {
                  width: '100% !important',
                  maxWidth: 'none !important',
                  minWidth: '0 !important',
                  flex: '0 0 auto !important',
                },
              }}
            >
              {renderCustomSearch({ draft, setDraft, commitSearch, searchPlaceholder, mode: "mobile" })}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              {onClearFilters && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    onClearFilters();
                    setMobileFiltersOpen(false);
                  }}
                  startIcon={<ClearIcon fontSize="small" />}
                  sx={{ flex: 1 }}
                >
                  {tI18n('dataTable', 'clearFilters')}
                </Button>
              )}
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  applyFilterControls();
                  setMobileFiltersOpen(false);
                }}
                startIcon={<SearchIcon fontSize="small" />}
                sx={{ flex: 1 }}
              >
                {tI18n('common', 'search')}
              </Button>
            </Box>
          </Box>
        </Drawer>
      )}
      {filterBar && (
        <div className="dt-filter-bar" style={{ backgroundColor: tableHeaderBackground }}>
          {filterBar}
        </div>
      )}

      {/* Error */}
      {error && (
        <Typography component="div" variant="body2" className="dt-error-banner">
          {error}
        </Typography>
      )}
      {/* Mass-actions bar – always rendered with fixed height to prevent layout shift */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          overflow: 'hidden',
          height: hasMassActions && someSelected ? 44 : 0,
          minHeight: hasMassActions && someSelected ? 44 : 0,
          transition: 'height 0.2s, min-height 0.2s',
          backgroundColor: 'rgba(255, 50, 84, 0.08)',
          borderBottom: hasMassActions && someSelected ? '1px solid' : 'none',
          borderColor: 'rgba(255, 50, 84, 0.18)',
          color: 'primary.main',
        }}
      >
        <Typography variant="body2" component="span" sx={{ color: 'inherit', mr: 1 }}>
          {tI18n('dataTable', 'selected').replace('{count}', String(selectedIds.size))}
        </Typography>
        {massActions?.map((action) => (
          <Tooltip key={action.label} title={action.label}>
            <Button
              size="small"
              variant="outlined"
              color={action.color ?? 'primary'}
              startIcon={action.icon}
              onClick={() => action.onClick(Array.from(selectedIds))}
            >
              {action.label}
            </Button>
          </Tooltip>
        ))}
        <Button
          size="small"
          variant="text"
          color="inherit"
          sx={{ ml: 'auto' }}
          onClick={() => setSelectedIds(new Set())}
        >
          {tI18n('dataTable', 'clearSelection')}
        </Button>
      </Box>
      {/* MUI DataGrid */}
      {shouldRenderGrid && (
        <Grow in={true}>
          <Box
            sx={{
              flex: '1 1 auto',
              height: '100%',
              minHeight: 320,
              width: '100%',
              backgroundColor: 'transparent',
              display: 'flex',
            }}
          >
            <DataGrid
              apiRef={apiRef}
              rows={displayRows}
              columns={muiColumns}
              loading={false}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              paginationMode="server"
              paginationModel={paginationModel}
              rowCount={pagination?.total || 0}
              sortModel={sortModel}
              onSortModelChange={handleSortModelChange}
              disableRowSelectionOnClick
              disableColumnMenu
              hideFooter
              getRowClassName={getRowClassName}
              sx={{
                height: '100%',
                border: 0,
                borderRadius: 0,
                backgroundColor: tableSurface,
                color: 'var(--scheme-neutral-100)',
                '& .MuiDataGrid-main': {
                  border: 'none',
                },
                '& .MuiDataGrid-virtualScroller': {
                  backgroundColor: tableSurface,
                },
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 400,
                  minWidth: 0,
                  minHeight: '53px !important',
                  maxHeight: '53px !important',
                  py: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  borderBottom: '1px solid color-mix(in srgb, var(--scheme-neutral-900) 72%, transparent)',
                  borderRight: 'none',
                  outline: 'none !important',
                  '&:focus, &:focus-within': {
                    outline: 'none !important',
                  },
                  '&.MuiDataGrid-cell--selected': {
                    outline: 'none !important',
                  },
                },
                '& .MuiDataGrid-row': {
                  backgroundColor: tableSurface,
                  borderBottom: '0px solid rgba(0, 0, 0, 0.08)',
                  transition: 'background-color 140ms ease, box-shadow 140ms ease',
                  '&:last-child': {
                    borderBottom: 'none',
                  },
                  '&:hover': {
                    backgroundColor: tableHoverBackground,
                    boxShadow: 'inset 3px 0 0 rgba(255, 50, 84, 0.34)',
                  },
                  '&.dt-row-selected': {
                    backgroundColor: tableSelectedBackground,
                  },
                  '&.dt-row-selected:hover': {
                    backgroundColor: tableSelectedHoverBackground,
                  },
                },
                '& .MuiDataGrid-columnHeaders': {
                  borderBottom: '1px solid color-mix(in srgb, var(--scheme-neutral-900) 78%, transparent)',
                  backgroundColor: tableHeaderBackground,
                  fontWeight: 400,
                  color: 'primary.main',
                  boxShadow: '0 1px 0 rgba(16, 24, 40, 0.04)',
                  textTransform: 'none',
                  fontSize: 'inherit'
                },
                '& .MuiDataGrid-columnHeader': {
                  borderRight: 'none',
                  textTransform: 'none',
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 500,
                  letterSpacing: 0,
                  textTransform: 'none',
                },
                '& .dt-grid-cell-actions': {
                  overflow: 'visible',
                  justifyContent: 'flex-end',
                  px: '8px',
                  zIndex: 1,
                  backgroundColor: 'inherit',
                },
                '& .MuiDataGrid-filler, & .MuiDataGrid-scrollbarFiller': {
                  backgroundColor: tableSurface,
                },
                '& .MuiDataGrid-columnSeparator': {
                  display: 'flex',
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  color: 'var(--scheme-neutral-700)',
                },
                '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-columnSeparator': {
                  opacity: 1,
                },
                '& .MuiDataGrid-columnSeparator--resizing': {
                  opacity: 1,
                  color: 'var(--scheme-primary, #1976d2)',
                },
              }}
            />
          </Box>
        </Grow>
      )}

      {useMobileCards && (
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            flexDirection: 'column',
            gap: 1.25,
            p: 1,
            flex: '1 1 auto',
            minHeight: 320,
            overflowY: 'auto',
            backgroundColor: 'color-mix(in srgb, var(--scheme-surface-raised) 74%, var(--scheme-surface-raised-subtle))',
          }}
        >
          {loading
            ? skeletonRows.slice(0, 4).map((row) => (
              <Skeleton key={row.id} variant="rounded" height={190} sx={{ borderRadius: '8px' }} />
            ))
            : rows.length > 0
              ? rows.map((row) => (
                <Box key={row.id}>
                  {renderMobileCard ? renderMobileCard(row) : renderDefaultMobileCard(row)}
                </Box>
              ))
              : (
                <Typography variant="body2" component="div" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  {emptyMessage}
                </Typography>
              )}
        </Box>
      )}

      {/* Custom pagination footer */}
      {pagination && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderTop: '1px solid color-mix(in srgb, var(--scheme-neutral-900) 74%, transparent)',
            backgroundColor: tableHeaderBackground,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {footerLeft}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" component="span">{tI18n('pagination', 'rowsPerPage')}</Typography>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <Select
                  value={pagination.pageSize}
                  onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
                  sx={{ '& .MuiSelect-select': { typography: 'body2' } }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Typography variant="body2" component="div" color="text.secondary">
              {`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                pagination.page * pagination.pageSize,
                pagination.total
              )} ${tI18n('pagination', 'of')} ${pagination.total}`}
            </Typography>
            <Pagination
              count={totalPages}
              page={pagination.page}
              onChange={(_, page) => pagination.onPageChange(page)}
              color="primary"
              shape="rounded"
              showFirstButton
              showLastButton
            />
          </Box>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, width: '100%' }}>
            <Typography variant="body2" component="div" color="text.secondary" sx={{ flex: 1 }}>
              {`${visibleCount} ${tI18n('pagination', 'of')} ${pagination.total}`}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={!canLoadMore || loading}
              onClick={() => {
                pagination.onPageChange(1);
                pagination.onPageSizeChange(Math.min(pagination.pageSize + preferences.itemsPerPage, pagination.total));
              }}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {tI18n('dataTable', 'loadMore')}
            </Button>
          </Box>
        </Box>
      )}
    </div>
  );
}
