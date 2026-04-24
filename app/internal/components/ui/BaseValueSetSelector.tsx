"use client";

import { useEffect, useState } from "react";
import StarIcon from "@mui/icons-material/Star";
import { listBaseValueSets, type BaseValueSetItem } from "../../lib/internalApi";
import { FormSelect } from "./FormSelect";

interface BaseValueSetSelectorProps {
    token: string;
    isAdmin: boolean;
    usedBaseValueSetId?: string | null;
    onChange?: (id: string) => void;
    onChangeItem?: (item: BaseValueSetItem) => void;
}

function formatUploadDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function BaseValueSetSelector({ token, isAdmin, usedBaseValueSetId, onChange, onChangeItem }: BaseValueSetSelectorProps) {
    const [sets, setSets] = useState<BaseValueSetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string>("");

    useEffect(() => {
        listBaseValueSets(token, { pageSize: 100, showArchived: false })
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
                if (resolved) onChangeItem?.(resolved);
            })
            .catch(() => { /* non-critical */ })
            .finally(() => setLoading(false));
    }, [token]);

    useEffect(() => {
        if (usedBaseValueSetId && sets.find((s) => s.id === usedBaseValueSetId)) {
            setSelected(usedBaseValueSetId);
        }
    }, [usedBaseValueSetId, sets]);

    if (loading || sets.length === 0) return null;

    const current = sets.find((s) => s.id === selected);


    return isAdmin ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FormSelect
                label=""
                options={sets.map((s) => ({
                    value: s.id,
                    label: `${s.name}  v${s.version}`,
                    secondaryLabel: `Uploaded ${formatUploadDate(s.createdAt)}`,
                    icon: s.isActive ? <StarIcon sx={{ fontSize: 13, color: "warning.main" }} /> : undefined,
                }))}
                value={selected}
                onChange={(id) => {
                    if (!id) return;
                    const idStr = String(id);
                    setSelected(idStr);
                    onChange?.(idStr);
                    const item = sets.find((s) => s.id === idStr);
                    if (item) onChangeItem?.(item);
                }}
                fullWidth
                textFieldProps={{ size: "small", placeholder: "Select base values set…" }}
                sx={{ minWidth: 360 }}
            />
        </div>
    ) : null;
}
