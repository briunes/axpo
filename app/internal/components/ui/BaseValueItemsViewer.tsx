"use client";

import {
    Box,
    Chip,
    InputAdornment,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useMemo, useState } from "react";
import type { BaseValueItem } from "../../lib/internalApi";

interface BaseValueItemsViewerProps {
    items: BaseValueItem[];
    pageSize?: number;
}

export function BaseValueItemsViewer({ items, pageSize = 25 }: BaseValueItemsViewerProps) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(pageSize);
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.trim().toLowerCase();
        return items.filter(
            (item) =>
                item.key.toLowerCase().includes(q) ||
                (item.unit ?? "").toLowerCase().includes(q),
        );
    }, [items, search]);

    const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(0);
    };

    // Compute breakdown by key prefix for the summary chips
    const prefixCounts = useMemo(() => {
        const map: Record<string, number> = {};
        for (const item of items) {
            const prefix = item.key.split(":").slice(0, 2).join(":");
            map[prefix] = (map[prefix] ?? 0) + 1;
        }
        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
    }, [items]);

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 2,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: "info.50",
                    border: "1px solid",
                    borderColor: "info.200",
                }}
            >
                <InfoOutlinedIcon fontSize="small" sx={{ color: "info.main", flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary">
                    This set has <strong>{items.length} items</strong> — manual editing is disabled for large sets. Re-run{" "}
                    <code style={{ fontSize: "0.78em" }}>pnpm run db:import-prices:replace</code> to update prices from the Excel file.
                </Typography>
            </Box>

            {/* Summary chips */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
                {prefixCounts.map(([prefix, count]) => (
                    <Chip
                        key={prefix}
                        label={`${prefix}: ${count}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: "monospace", fontSize: "0.72rem" }}
                    />
                ))}
            </Box>

            {/* Search */}
            <TextField
                size="small"
                placeholder="Filter by key or unit…"
                value={search}
                onChange={handleSearchChange}
                sx={{ mb: 1.5, width: 340 }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    },
                }}
            />

            <TableContainer component={Paper} variant="outlined">
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>Key</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Value</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginated.map((item) => (
                            <TableRow key={item.key} hover>
                                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                                    {item.key}
                                </TableCell>
                                <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                                    {item.valueNumeric !== undefined && item.valueNumeric !== null
                                        ? Number(item.valueNumeric).toPrecision(6)
                                        : item.valueText ?? "—"}
                                </TableCell>
                                <TableCell sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
                                    {item.unit ?? ""}
                                </TableCell>
                            </TableRow>
                        ))}
                        {paginated.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                    No items match "{search}"
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                rowsPerPageOptions={[25, 50, 100]}
                labelDisplayedRows={({ from, to, count }) =>
                    `${from}–${to} of ${count}${search ? " (filtered)" : ""}`
                }
            />
        </Box>
    );
}
