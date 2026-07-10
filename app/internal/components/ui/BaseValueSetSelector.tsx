"use client";

import { useEffect, useState } from "react";
import StarIcon from "@mui/icons-material/Star";
import { listBaseValueSets, type BaseValueSetItem } from "../../lib/internalApi";
import { FormSelect } from "./FormSelect";

interface BaseValueSetSelectorProps {
    token: string;
    isAdmin: boolean;
    usedBaseValueSetId?: string | null;
    scopeType?: BaseValueSetItem["scopeType"];
    forAgencyId?: string;
    onChange?: (id: string, meta?: { userInitiated: boolean }) => void;
    onChangeItem?: (item: BaseValueSetItem) => void;
    compact?: boolean;
}

const COMPACT_SELECTOR_WIDTH = 360;
const DEFAULT_SELECTOR_MIN_WIDTH = 320;
const DEFAULT_SELECTOR_MAX_WIDTH = 420;

function formatUploadDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function BaseValueSetSelector({ token, isAdmin, usedBaseValueSetId, scopeType, forAgencyId, onChange, onChangeItem, compact = false }: BaseValueSetSelectorProps) {
    const [sets, setSets] = useState<BaseValueSetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string>("");

    useEffect(() => {
        listBaseValueSets(token, { pageSize: 100, showArchived: false, scopeType, forAgencyId, minimal: true })
            .then((res) => {
                setSets(res.items);
                let resolved: BaseValueSetItem | undefined;
                if (usedBaseValueSetId && res.items.find((s) => s.id === usedBaseValueSetId)) {
                    setSelected(usedBaseValueSetId);
                    resolved = res.items.find((s) => s.id === usedBaseValueSetId);
                } else {
                    const def =
                        res.items.find((s) => s.isProduction && !s.isDeleted) ??
                        res.items.find((s) => s.isActive && !s.isDeleted) ??
                        res.items[0];
                    if (def) { setSelected(def.id); resolved = def; }
                }
                if (resolved) {
                    onChange?.(resolved.id, { userInitiated: false });
                    onChangeItem?.(resolved);
                }
            })
            .catch(() => { /* non-critical */ })
            .finally(() => setLoading(false));
    }, [token, scopeType, forAgencyId]);

    useEffect(() => {
        if (usedBaseValueSetId && sets.find((s) => s.id === usedBaseValueSetId)) {
            setSelected(usedBaseValueSetId);
        }
    }, [usedBaseValueSetId, sets]);

    if (loading || sets.length === 0) return null;

    const current = sets.find((s) => s.id === selected);


    return isAdmin ? (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
                width: compact ? `min(100%, ${COMPACT_SELECTOR_WIDTH}px)` : "auto",
                flex: compact ? `0 1 ${COMPACT_SELECTOR_WIDTH}px` : "0 0 auto",
            }}
        >
            <FormSelect
                label=""
                options={sets.map((s) => ({
                    value: s.id,
                    label: `${s.name}  v${s.version}`,
                    secondaryLabel: `Uploaded ${formatUploadDate(s.createdAt)}`,
                    icon: s.isActive ? <StarIcon sx={{ color: "warning.main" }} /> : undefined,
                }))}
                value={selected}
                onChange={(id) => {
                    if (!id) return;
                    const idStr = String(id);
                    setSelected(idStr);
                    onChange?.(idStr, { userInitiated: true });
                    const item = sets.find((s) => s.id === idStr);
                    if (item) onChangeItem?.(item);
                }}
                fullWidth={compact}
                textFieldProps={{ size: "small", placeholder: "Select base values set…" }}
                sx={{
                    width: compact ? "100%" : "auto",
                    minWidth: compact ? 0 : { xs: 0, sm: DEFAULT_SELECTOR_MIN_WIDTH },
                    maxWidth: compact ? COMPACT_SELECTOR_WIDTH : DEFAULT_SELECTOR_MAX_WIDTH,
                    "& .MuiInputBase-root": compact
                        ? {
                            minHeight: 36,
                        }
                        : undefined,
                }}
            />
        </div>
    ) : null;
}
