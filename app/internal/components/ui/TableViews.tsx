"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import { FormInput } from "./FormInput";

export interface SavedTableView<TView> {
  id: string;
  name: string;
  view: TView;
}

export interface TableViewPreset<TView> extends SavedTableView<TView> {
  kind?: "default" | "saved";
}

const CUSTOM_VIEW_OPTION = "__custom";

function normalizeValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = normalizeValue((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

function isSameView<TView>(left: TView, right: TView) {
  return JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right));
}

function loadSavedViews<TView>(storageKey: string): SavedTableView<TView>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTableView<TView>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedViews<TView>(storageKey: string, views: SavedTableView<TView>[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(views));
  } catch {
    // ignore local persistence failures
  }
}

export function useTableViews<TView>({
  storageKey,
  currentView,
  presets,
}: {
  storageKey: string;
  currentView: TView;
  presets: Array<SavedTableView<TView>>;
}) {
  const [savedViews, setSavedViews] = useState<Array<SavedTableView<TView>>>([]);

  useEffect(() => {
    setSavedViews(loadSavedViews<TView>(storageKey));
  }, [storageKey]);

  const viewPresets = useMemo<Array<TableViewPreset<TView>>>(
    () => [
      ...presets.map((view) => ({ ...view, kind: "default" as const })),
      ...savedViews.map((view) => ({ ...view, kind: "saved" as const })),
    ],
    [presets, savedViews],
  );

  const activeViewPresetId = useMemo(
    () => viewPresets.find((preset) => isSameView(preset.view, currentView))?.id,
    [currentView, viewPresets],
  );

  const saveCurrentView = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nextViews = [
      ...savedViews.filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase()),
      {
        id: `view-${Date.now()}`,
        name: trimmed,
        view: currentView,
      },
    ];
    setSavedViews(nextViews);
    persistSavedViews(storageKey, nextViews);
  }, [currentView, savedViews, storageKey]);

  const deleteSavedView = useCallback((id: string) => {
    const nextViews = savedViews.filter((view) => view.id !== id);
    setSavedViews(nextViews);
    persistSavedViews(storageKey, nextViews);
  }, [savedViews, storageKey]);

  return {
    savedViews,
    viewPresets,
    activeViewPresetId,
    saveCurrentView,
    deleteSavedView,
  };
}

export function TableViewSearchControls<TView>({
  activeViewPresetId,
  viewPresets,
  savedViews,
  onApplyView,
  onDeleteSavedView,
  labels,
  draft,
  setDraft,
  commitSearch,
  searchPlaceholder,
  onLiveSearchChange,
  onClearSearch,
  debounceMs = 400,
}: {
  activeViewPresetId?: string;
  viewPresets: Array<TableViewPreset<TView>>;
  savedViews: Array<SavedTableView<TView>>;
  onApplyView: (view: TView) => void;
  onDeleteSavedView: (id: string) => void;
  labels: {
    customView: string;
    savedViewsGroup: string;
    viewPreset: string;
    clear: string;
  };
  draft: string;
  setDraft: (value: string) => void;
  commitSearch: () => void;
  searchPlaceholder: string;
  onLiveSearchChange: (value: string) => void;
  onClearSearch: () => void;
  debounceMs?: number;
}) {
  const isFirstSearchSync = useRef(true);
  const onLiveSearchChangeRef = useRef(onLiveSearchChange);

  useEffect(() => {
    onLiveSearchChangeRef.current = onLiveSearchChange;
  }, [onLiveSearchChange]);

  useEffect(() => {
    if (isFirstSearchSync.current) {
      isFirstSearchSync.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      onLiveSearchChangeRef.current(draft);
    }, debounceMs);
    return () => window.clearTimeout(timeout);
  }, [debounceMs, draft]);

  return (
    <>
      <Box sx={{ flex: "0 1 220px", minWidth: 170, maxWidth: 240 }}>
        <TextField
          select
          size="small"
          label={labels.viewPreset}
          value={activeViewPresetId ?? CUSTOM_VIEW_OPTION}
          onChange={(event) => {
            const preset = viewPresets.find((view) => view.id === event.target.value);
            if (preset) onApplyView(preset.view);
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
              if (value === CUSTOM_VIEW_OPTION) return labels.customView;
              return viewPresets.find((view) => view.id === value)?.name ?? labels.viewPreset;
            },
          }}
        >
          <MenuItem value={CUSTOM_VIEW_OPTION} disabled>
            {labels.customView}
          </MenuItem>
          {viewPresets.filter((view) => view.kind === "default").map((view) => (
            <MenuItem key={view.id} value={view.id}>
              {view.name}
            </MenuItem>
          ))}
          {savedViews.length > 0 && (
            <MenuItem disabled sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>
              {labels.savedViewsGroup}
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
                  aria-label={labels.clear}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteSavedView(view.id);
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
      <Box sx={{ flex: "0 1 380px", minWidth: 220, maxWidth: 420 }}>
        <FormInput
          label=""
          placeholder={searchPlaceholder}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onLiveSearchChange(draft);
              commitSearch();
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
                    onClearSearch();
                  }}
                  aria-label={labels.clear}
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
  );
}

export function TableFilterButton({
  title,
  activeFilterCount,
  onClick,
}: {
  title: string;
  activeFilterCount: number;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <Tooltip title={title}>
      <Badge
        color="primary"
        badgeContent={activeFilterCount || undefined}
        variant={activeFilterCount ? "standard" : "dot"}
        invisible={!activeFilterCount}
      >
        <IconButton size="small" onClick={onClick} aria-label={title}>
          <FilterListIcon fontSize="small" color="primary" />
        </IconButton>
      </Badge>
    </Tooltip>
  );
}

export function TableFiltersDialog({
  open,
  title,
  saveViewLabel,
  clearLabel,
  applyLabel,
  onClose,
  onOpenSaveView,
  onClear,
  onApply,
  children,
}: {
  open: boolean;
  title: string;
  saveViewLabel: string;
  clearLabel: string;
  applyLabel: string;
  onClose: () => void;
  onOpenSaveView?: () => void;
  onClear: () => void;
  onApply: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
            {title}
          </Typography>
          {onOpenSaveView && (
            <Button size="small" variant="text" onClick={onOpenSaveView} sx={{ minWidth: 0 }}>
              {saveViewLabel}
            </Button>
          )}
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
            alignItems: "start",
          }}
        >
          {children}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button size="small" variant="text" onClick={onClear}>
            {clearLabel}
          </Button>
          <Button size="small" variant="contained" onClick={onApply}>
            {applyLabel}
          </Button>
        </Box>
      </Stack>
    </Dialog>
  );
}

export function SaveTableViewDialog({
  open,
  title,
  description,
  nameLabel,
  cancelLabel,
  saveLabel,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  nameLabel: string;
  cancelLabel: string;
  saveLabel: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name);
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          <TextField
            autoFocus
            label={nameLabel}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSave();
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelLabel}</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>
          {saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
