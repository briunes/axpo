"use client";

import { Box, Button, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import type { BaseValueItem } from "../../lib/internalApi";

interface BaseValueItemBuilderProps {
    items: BaseValueItem[];
    onChange: (items: BaseValueItem[]) => void;
}

const newItem = (): BaseValueItem => ({ key: "", valueNumeric: undefined, unit: "" });

export function BaseValueItemBuilder({ items, onChange }: BaseValueItemBuilderProps) {
    const handleField = (
        index: number,
        field: keyof BaseValueItem,
        value: string | number | undefined,
    ) => {
        onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const handleRemove = (index: number) => onChange(items.filter((_, i) => i !== index));
    const handleAdd = () => onChange([...items, newItem()]);

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Items
            </Typography>

            {/* Header */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr 40px",
                    gap: 1,
                    mb: 0.5,
                    px: 0.5,
                }}
            >
                {["Key *", "Num. value", "Text value", "Unit", "Eff. from", "Eff. to", ""].map((h) => (
                    <Typography key={h} variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {h}
                    </Typography>
                ))}
            </Box>

            {/* Rows */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {items.map((item, i) => (
                    <Box
                        key={i}
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr 40px",
                            gap: 1,
                            alignItems: "center",
                        }}
                    >
                        <TextField
                            size="small"
                            value={item.key}
                            onChange={(e) => handleField(i, "key", e.target.value)}
                            placeholder="e.g. PRECIO_GAS"
                            required
                        />
                        <TextField
                            size="small"
                            type="number"
                            value={item.valueNumeric ?? ""}
                            onChange={(e) =>
                                handleField(
                                    i,
                                    "valueNumeric",
                                    e.target.value === "" ? undefined : parseFloat(e.target.value),
                                )
                            }
                            placeholder="0.00"
                        />
                        <TextField
                            size="small"
                            value={item.valueText ?? ""}
                            onChange={(e) => handleField(i, "valueText", e.target.value || undefined)}
                            placeholder="optional"
                        />
                        <TextField
                            size="small"
                            value={item.unit ?? ""}
                            onChange={(e) => handleField(i, "unit", e.target.value || undefined)}
                            placeholder="€/MWh"
                        />
                        <TextField
                            size="small"
                            type="date"
                            value={item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : ""}
                            onChange={(e) => handleField(i, "effectiveFrom", e.target.value || undefined)}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                            size="small"
                            type="date"
                            value={item.effectiveTo ? item.effectiveTo.slice(0, 10) : ""}
                            onChange={(e) => handleField(i, "effectiveTo", e.target.value || undefined)}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <Tooltip title="Remove row" placement="top">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemove(i)}
                                    disabled={items.length <= 1}
                                    sx={{ color: "error.main", opacity: items.length <= 1 ? 0.3 : 1 }}
                                >
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                ))}
            </Box>

            <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                sx={{ mt: 1.5 }}
            >
                Add row
            </Button>
        </Box>
    );
}
