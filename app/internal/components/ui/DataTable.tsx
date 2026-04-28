"use client";

import { DataGrid, type GridColDef, type GridSortModel } from "@mui/x-data-grid";
import { Box, IconButton, Skeleton, Pagination, Select, MenuItem, FormControl, Checkbox, Button, Tooltip, useTheme, Collapse } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useMemo, useState } from "react";
import { useUserPreferences } from "../providers/UserPreferencesProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  renderCell: (row: T) => React.ReactNode;
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

export interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  rows: T[];
  loading?: boolean;
  error?: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  sortState?: SortState;
  onSort?: (column: string) => void;
  toolbarLeft?: React.ReactNode;
  renderCustomSearch?: (params: {
    draft: string;
    setDraft: (value: string) => void;
    commitSearch: () => void;
    searchPlaceholder: string;
  }) => React.ReactNode;
  filterBar?: React.ReactNode;
  pagination?: PaginationState;
  rowActions?: (row: T) => React.ReactNode;
  headerRight?: React.ReactNode;
  footerLeft?: React.ReactNode;
  emptyMessage?: string;
  t?: (namespace: any, key: string) => string;
  massActions?: MassAction[];
}

const BASE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ── Component ─────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading = false,
  error,
  searchValue = "",
  onSearch,
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
}: DataTableProps<T>) {
  const { preferences } = useUserPreferences();
  const theme = useTheme()
  // Row selection state (only active when massActions provided)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hasMassActions = Boolean(massActions && massActions.length > 0);

  const visibleRowIds = useMemo(
    () => (loading ? [] : rows.map((r) => r.id)),
    [loading, rows]
  );

  const allSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id));
  const someSelected = visibleRowIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleRowIds));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Clear selection when rows change (e.g. page change)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [rows]);

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
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={toggleSelectAll}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        renderCell: (params: import("@mui/x-data-grid").GridRenderCellParams<T>) => {
          return (
            <Checkbox
              size="small"
              checked={selectedIds.has(params.row.id)}
              onChange={() => toggleRow(params.row.id)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
      } as GridColDef<T>);
    }

    cols.push(...columns.map((col): GridColDef<T> => ({
      field: col.key,
      headerName: col.label.toUpperCase(),
      sortable: col.sortable ?? false,
      width: col.width ? parseInt(col.width) : undefined,
      flex: !col.width ? 1 : undefined,
      renderCell: (params) => {
        // Show skeleton when loading
        if (loading && (params.row as any).__skeleton) {
          return <Skeleton variant="rounded" width="100%" height={'50%'} />;
        }
        return col.renderCell(params.row);
      },
    })));

    // Add actions column if rowActions provided
    if (rowActions) {
      cols.push({
        field: "actions",
        headerName: "ACTIONS",
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
  }, [columns, rowActions, loading, hasMassActions, allSelected, someSelected, selectedIds, toggleSelectAll, toggleRow]);

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

  // Handle sort model changes
  const handleSortModelChange = (model: GridSortModel) => {
    if (onSort && model.length > 0) {
      onSort(model[0].field);
    }
  };

  const sortModel: GridSortModel = sortState
    ? [{ field: sortState.column, sort: sortState.direction }]
    : [];

  return (
    <div className="dt-root">
      {/* Toolbar */}
      <div className="dt-toolbar">

        <div className="dt-toolbar-left">
          {renderCustomSearch ? (
            renderCustomSearch({ draft, setDraft, commitSearch, searchPlaceholder })
          ) : (
            toolbarLeft
          )}
        </div>

        {!renderCustomSearch && (
          <div className="dt-toolbar-center">
            {onSearch && (
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
                <IconButton
                  size="small"
                  onClick={() => { setDraft(""); if (onSearch) onSearch(""); }}
                  aria-label="Clear"
                  sx={{ visibility: draft ? "visible" : "hidden" }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
                <IconButton
                  className="dt-search-btn"
                  size="small"
                  onClick={commitSearch}
                  aria-label="Search"
                >
                  <SearchIcon fontSize="inherit" color="primary" />
                </IconButton>
              </div>
            )}
          </div>
        )}
        <div className="dt-toolbar-right">
          {headerRight}
        </div>
      </div>

      {/* Filter bar */}
      {filterBar && <div className="dt-filter-bar">{filterBar}</div>}

      {/* Error */}
      {error && <div className="dt-error-banner">{error}</div>}
      <Collapse in={hasMassActions && someSelected}>
        {/* Mass-actions bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            backgroundColor: 'primary.50',
            borderBottom: '1px solid',
            borderColor: 'primary.100',
          }}
        >
          <span style={{ fontSize: 14, color: 'inherit', marginRight: 8 }}>
            {selectedIds.size} selected
          </span>
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
            Clear selection
          </Button>
        </Box>
      </Collapse>
      {/* MUI DataGrid */}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={displayRows}
          columns={muiColumns}
          loading={false}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          paginationMode="server"
          paginationModel={{
            pageSize: pagination?.pageSize || preferences.itemsPerPage,
            page: pagination ? pagination.page - 1 : 0
          }}
          rowCount={pagination?.total || 0}
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          disableRowSelectionOnClick
          disableColumnMenu
          hideFooter
          getRowClassName={(params) =>
            hasMassActions && selectedIds.has(params.row.id) ? 'dt-row-selected' : ''
          }
          sx={{
            border: '0px solid rgba(0, 0, 0, 0.12)',
            borderRadius: '8px',
            '& .MuiDataGrid-main': {
              border: 'none',
            },
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
              minHeight: '52px !important',
              maxHeight: '52px !important',
              py: 0,
              borderBottom: 'none',
              borderRight: 'none',
            },
            '& .MuiDataGrid-row': {
              borderBottom: '0px solid rgba(0, 0, 0, 0.08)',
              '&:last-child': {
                borderBottom: 'none',
              },
              '&.dt-row-selected': {
                backgroundColor: theme.palette.primary.main + "20",
              },
              '&.dt-row-selected:hover': {
                backgroundColor: theme.palette.primary.main + "30",
              },
            },
            '& .MuiDataGrid-columnHeaders': {
              borderBottom: '0px solid rgba(0, 0, 0, 0.12)',
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.secondary',
            },
            '& .MuiDataGrid-columnHeader': {
              borderRight: 'none',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
            },
            '& .MuiDataGrid-columnSeparator': {
              display: 'none',
            },
          }}
        />
      </Box>

      {/* Custom pagination footer */}
      {pagination && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1,
            borderTop: '1px solid rgba(0, 0, 0, 0.12)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {footerLeft}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '14px' }}>
              <span>{t ? t('pagination', 'rowsPerPage') : 'Rows per page:'}</span>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <Select
                  value={pagination.pageSize}
                  onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
                  sx={{ fontSize: '14px' }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ fontSize: '14px', color: 'text.secondary' }}>
              {`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                pagination.page * pagination.pageSize,
                pagination.total
              )} of ${pagination.total}`}
            </Box>
            <Pagination
              count={Math.ceil(pagination.total / pagination.pageSize)}
              page={pagination.page}
              onChange={(_, page) => pagination.onPageChange(page)}
              color="primary"
              shape="rounded"
              showFirstButton
              showLastButton
            />
          </Box>
        </Box>
      )}
    </div>
  );
}
