"use client";

import { DataGrid, type GridColDef, type GridSortModel } from "@mui/x-data-grid";
import { Box, IconButton, Skeleton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useMemo, useState } from "react";

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
  filterBar?: React.ReactNode;
  pagination?: PaginationState;
  rowActions?: (row: T) => React.ReactNode;
  headerRight?: React.ReactNode;
  footerLeft?: React.ReactNode;
  emptyMessage?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
  filterBar,
  pagination,
  rowActions,
  headerRight,
  footerLeft,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  // Convert custom ColumnDef to MUI GridColDef
  const muiColumns: GridColDef<T>[] = useMemo(() => {
    const cols: GridColDef<T>[] = columns.map((col) => ({
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
    }));

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
  }, [columns, rowActions, loading]);

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
        <div className="dt-toolbar-right">
          {headerRight}
        </div>
      </div>

      {/* Filter bar */}
      {filterBar && <div className="dt-filter-bar">{filterBar}</div>}

      {/* Error */}
      {error && <div className="dt-error-banner">{error}</div>}

      {/* MUI DataGrid */}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={displayRows}
          columns={muiColumns}
          loading={false}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: pagination?.pageSize || 25,
                page: pagination ? pagination.page - 1 : 0
              }
            },
          }}
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          disableRowSelectionOnClick
          disableColumnMenu
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
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid rgba(0, 0, 0, 0.12)',
            },
          }}
        />
      </Box>

      {/* Footer for custom pagination */}
      {pagination && footerLeft && (
        <div className="dt-footer">
          <div className="dt-footer-left">
            {footerLeft}
          </div>
        </div>
      )}
    </div>
  );
}
