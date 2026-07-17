"use client";

import { useCallback, useState } from "react";
import {
  SaveTableViewDialog,
  TableViewSearchControls,
  useTableViews,
  type SavedTableView,
} from "../ui";

type Translate = (namespace: any, key: string, params?: Record<string, string | number>) => string;

export function useLogTableToolbar<TView>({
  storageKey,
  currentView,
  presets,
  applyView,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  t,
}: {
  storageKey: string;
  currentView: TView;
  presets: Array<SavedTableView<TView>>;
  applyView: (view: TView) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  t: Translate;
}) {
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const {
    savedViews,
    viewPresets,
    activeViewPresetId,
    saveCurrentView,
    deleteSavedView,
  } = useTableViews<TView>({
    storageKey,
    currentView,
    presets,
  });

  const renderCustomSearch = useCallback(({
    draft,
    setDraft,
    commitSearch,
    searchPlaceholder: placeholder,
  }: {
    draft: string;
    setDraft: (value: string) => void;
    commitSearch: () => void;
    searchPlaceholder: string;
    mode: "desktop" | "mobile";
  }) => (
    <TableViewSearchControls
      activeViewPresetId={activeViewPresetId}
      viewPresets={viewPresets}
      savedViews={savedViews}
      onApplyView={applyView}
      onDeleteSavedView={deleteSavedView}
      labels={{
        customView: t("simulationsModule", "customView"),
        savedViewsGroup: t("simulationsModule", "savedViewsGroup"),
        viewPreset: t("simulationsModule", "viewPresetLabel"),
        clear: t("actions", "clear"),
      }}
      draft={draft}
      setDraft={setDraft}
      commitSearch={commitSearch}
      searchPlaceholder={placeholder}
      onLiveSearchChange={onSearchChange}
      onClearSearch={() => onSearchChange("")}
    />
  ), [activeViewPresetId, applyView, deleteSavedView, onSearchChange, savedViews, t, viewPresets]);

  const saveViewDialog = (
    <SaveTableViewDialog
      open={saveViewOpen}
      title={t("simulationsModule", "saveViewTitle")}
      description={t("simulationsModule", "saveViewDescription")}
      nameLabel={t("simulationsModule", "viewName")}
      cancelLabel={t("simulationsModule", "cancel")}
      saveLabel={t("simulationsModule", "save")}
      onClose={() => setSaveViewOpen(false)}
      onSave={saveCurrentView}
    />
  );

  return {
    activeViewPresetId,
    openSaveViewDialog: () => setSaveViewOpen(true),
    renderCustomSearch,
    saveViewDialog,
    searchProps: {
      searchValue,
      onSearch: onSearchChange,
      searchPlaceholder,
      renderCustomSearch,
      showFilterSubmitActions: false,
      showFilterLabel: false,
    },
  };
}
