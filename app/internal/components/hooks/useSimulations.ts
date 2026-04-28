"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cloneSimulation,
  applySimulationOcrPrefill,
  downloadSimulationPdf,
  createSimulation,
  listSimulations,
  rotateSimulationPinSnapshot,
  shareSimulation,
  simulationStatusTone,
  softDeleteSimulation,
  updateSimulation,
  validateCups,
  calculateSimulation,
  bulkDeleteSimulations,
  bulkArchiveSimulations,
  type CupsValidationResult,
  type SimulationItem,
} from "../../lib/internalApi";
import type { SimulationPayload, SimulationResults } from "@/domain/types";
import type { SessionState } from "../../lib/authSession";
import { keepPreviousData } from "@tanstack/react-query";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

export interface SimulationsActions {
  simulations: SimulationItem[];
  loading: boolean;
  busyAction: string | null;
  errorText: string | null;
  successText: string | null;
  clearFeedback: () => void;
  refresh: (
    overrides?: import("../../lib/internalApi").ListSimulationsParams,
  ) => Promise<void>;
  // pagination
  page: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  // sort
  sortColumn: string;
  sortDir: "asc" | "desc";
  setSort: (column: string, dir: "asc" | "desc") => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  // filters
  filterSearch: string;
  setFilterSearch: (v: string) => void;
  filterOwnerUserId: string;
  setFilterOwnerUserId: (v: string) => void;
  filterClientId: string;
  setFilterClientId: (v: string) => void;
  filterCups: string;
  setFilterCups: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  applyFilters: () => void;
  filtersAppliedAt: number;
  // create form state
  clientName: string;
  setClientName: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  cups: string;
  setCups: (v: string) => void;
  offerType: string;
  setOfferType: (v: string) => void;
  expiresDays: string;
  setExpiresDays: (v: string) => void;
  cupsValidation: CupsValidationResult | null;
  cupsValidationBusy: boolean;
  handleValidateCups: () => Promise<void>;
  handleCreateSimulation: (e: React.FormEvent) => Promise<void>;
  // edit state
  selectedSimulationId: string | null;
  editSimulationStatus: "DRAFT" | "SHARED" | "EXPIRED";
  editSimulationExpiry: string;
  editPayloadJson: string;
  openSimulationEditor: (sim: SimulationItem) => void;
  closeSimulationEditor: () => void;
  setEditSimulationStatus: (v: "DRAFT" | "SHARED" | "EXPIRED") => void;
  setEditSimulationExpiry: (v: string) => void;
  setEditPayloadJson: (v: string) => void;
  handleUpdateSimulation: (e: React.FormEvent) => Promise<void>;
  // actions
  handleShare: (sim: SimulationItem) => Promise<SimulationItem>;
  handleClone: (sim: SimulationItem) => Promise<void>;
  handleRotatePin: (sim: SimulationItem) => Promise<void>;
  handleOcrPrefill: (sim: SimulationItem) => Promise<void>;
  handlePdfDownload: (sim: SimulationItem) => Promise<void>;
  handleArchive: (sim: SimulationItem) => Promise<void>;
  handleBulkDelete: (ids: string[]) => Promise<void>;
  handleBulkArchive: (ids: string[]) => Promise<void>;
  handleSaveAndCalculate: (
    simId: string,
    payload: SimulationPayload,
  ) => Promise<SimulationResults | null>;
  // calculate panel state
  calcSim: SimulationItem | null;
  openCalcPanel: (sim: SimulationItem) => void;
  closeCalcPanel: () => void;
  simulationStatusTone: typeof simulationStatusTone;
  formatDate: typeof formatDate;
}

export function useSimulations(
  session: SessionState | null,
  initialPageSize = 25,
): SimulationsActions {
  const queryClient = useQueryClient();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  // sync pageSize when user preferences load
  useEffect(() => {
    setPageSize(initialPageSize);
    setPage(1);
  }, [initialPageSize]);
  // sort
  const [sortColumn, setSortColumn] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const setSort = (column: string, dir: "asc" | "desc") => {
    setSortColumn(column);
    setSortDir(dir);
  };
  const [showArchived, setShowArchived] = useState(false);

  // filters — pending = what the user is typing; applied = what was last submitted
  const [filterSearch, setFilterSearch] = useState("");
  const [filterOwnerUserId, setFilterOwnerUserId] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterCups, setFilterCups] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedOwnerUserId, setAppliedOwnerUserId] = useState("");
  const [appliedClientId, setAppliedClientId] = useState("");
  const [appliedCups, setAppliedCups] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [filtersAppliedAt, setFiltersAppliedAt] = useState(0);

  // create form
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [cups, setCups] = useState("ES0021000000123456AB");
  const [offerType, setOfferType] = useState("Electricity");
  const [expiresDays, setExpiresDays] = useState("30");
  const [cupsValidation, setCupsValidation] =
    useState<CupsValidationResult | null>(null);
  const [cupsValidationBusy, setCupsValidationBusy] = useState(false);

  // edit form
  const [selectedSimulationId, setSelectedSimulationId] = useState<
    string | null
  >(null);
  const [editSimulationStatus, setEditSimulationStatus] = useState<
    "DRAFT" | "SHARED" | "EXPIRED"
  >("DRAFT");
  const [editSimulationExpiry, setEditSimulationExpiry] = useState("");
  const [editPayloadJson, setEditPayloadJson] = useState("{}");

  // calculate panel
  const [calcSim, setCalcSim] = useState<SimulationItem | null>(null);
  const openCalcPanel = (sim: SimulationItem) => setCalcSim(sim);
  const closeCalcPanel = () => setCalcSim(null);

  const clearFeedback = () => {
    setErrorText(null);
    setSuccessText(null);
  };

  // ── TanStack Query ──────────────────────────────────────────────────────
  const queryParams = {
    page,
    pageSize,
    orderBy: sortColumn,
    sortDir,
    includeDeleted: showArchived || undefined,
    search: appliedSearch || undefined,
    ownerUserId: appliedOwnerUserId || undefined,
    clientId: appliedClientId || undefined,
    cups: appliedCups || undefined,
    status: appliedStatus || undefined,
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["simulations", session?.token ?? "", queryParams],
    queryFn: () => listSimulations(session!.token, queryParams),
    enabled: !!session,
    placeholderData: keepPreviousData,
  });

  const simulations = data?.items ?? [];
  const total = data?.total ?? 0;
  const loading = isFetching;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["simulations", session?.token ?? ""],
    });
  }, [queryClient, session?.token]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  // ────────────────────────────────────────────────────────────────────────

  const runAction = async (id: string, fn: () => Promise<void>) => {
    try {
      setBusyAction(id);
      clearFeedback();
      await fn();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const applyFilters = useCallback(() => {
    setAppliedSearch(filterSearch);
    setAppliedOwnerUserId(filterOwnerUserId);
    setAppliedClientId(filterClientId);
    setAppliedCups(filterCups);
    setAppliedStatus(filterStatus);
    setFiltersAppliedAt((n) => n + 1);
    setPage(1);
  }, [
    filterSearch,
    filterOwnerUserId,
    filterClientId,
    filterCups,
    filterStatus,
  ]);

  const handleValidateCups = async () => {
    if (!session) return;
    const candidate = cups.trim();
    if (candidate.length < 10) {
      setCupsValidation(null);
      return;
    }
    try {
      setCupsValidationBusy(true);
      const result = await validateCups(session.token, candidate);
      setCupsValidation(result);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "CUPS validation failed.",
      );
    } finally {
      setCupsValidationBusy(false);
    }
  };

  const handleCreateSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const days = Number(expiresDays);
    if (!Number.isFinite(days) || days <= 0) {
      setErrorText("Expiration days must be a positive number.");
      return;
    }
    await runAction("create-simulation", async () => {
      const cupsResult = await validateCups(session.token, cups);
      setCupsValidation(cupsResult);
      if (!cupsResult.valid)
        throw new Error(`CUPS format invalid: ${cupsResult.normalized}`);
      const expiresAt = new Date(
        Date.now() + days * 24 * 60 * 60 * 1000,
      ).toISOString();
      await createSimulation(session.token, {
        expiresAt,
        ...(clientId && { clientId }),
        payloadJson: { clientName, cups, offerType, source: "internal-ui" },
      });
      await invalidate();
      setSuccessText("Simulation created as draft.");
    });
  };

  const openSimulationEditor = (sim: SimulationItem) => {
    setSelectedSimulationId(sim.id);
    setEditSimulationStatus(
      (sim.status as "DRAFT" | "SHARED" | "EXPIRED") ?? "DRAFT",
    );
    setEditSimulationExpiry(sim.expiresAt ? sim.expiresAt.slice(0, 10) : "");
    setEditPayloadJson(
      sim.payloadJson ? JSON.stringify(sim.payloadJson, null, 2) : "{}",
    );
  };

  const closeSimulationEditor = () => setSelectedSimulationId(null);

  const handleUpdateSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedSimulationId) return;
    let parsedPayload: Record<string, unknown> | undefined;
    try {
      parsedPayload = JSON.parse(editPayloadJson) as Record<string, unknown>;
    } catch {
      setErrorText("Payload JSON is invalid — check your edits.");
      return;
    }
    const expiresAt = editSimulationExpiry
      ? new Date(`${editSimulationExpiry}T23:59:59.000Z`).toISOString()
      : null;
    await runAction("update-simulation", async () => {
      await updateSimulation(session.token, selectedSimulationId, {
        status: editSimulationStatus,
        expiresAt,
        payloadJson: parsedPayload,
      });
      await invalidate();
      setSuccessText("Simulation updated.");
      setSelectedSimulationId(null);
    });
  };

  const handleShare = async (sim: SimulationItem): Promise<SimulationItem> => {
    if (!session) throw new Error("No session.");
    const shared = await shareSimulation(session.token, sim.id);
    await invalidate();
    setSuccessText(
      shared.publicToken
        ? `Shared. Token: ${shared.publicToken.slice(0, 14)}...`
        : "Simulation shared.",
    );
    return shared;
  };

  const handleClone = async (sim: SimulationItem) => {
    await runAction(`clone-${sim.id}`, async () => {
      if (!session) return;
      await cloneSimulation(session.token, sim.id);
      await invalidate();
      setSuccessText("Simulation cloned.");
    });
  };

  const handleRotatePin = async (sim: SimulationItem) => {
    await runAction(`rotate-sim-pin-${sim.id}`, async () => {
      if (!session) return;
      await rotateSimulationPinSnapshot(session.token, sim.id);
      await invalidate();
      setSuccessText("PIN snapshot refreshed.");
    });
  };

  const handleOcrPrefill = async (sim: SimulationItem) => {
    await runAction(`ocr-sim-${sim.id}`, async () => {
      if (!session) return;
      await applySimulationOcrPrefill(session.token, sim.id, {
        ocrClientName: sim.ownerUser?.fullName ?? "AXPO OCR",
        ocrValidation: "manual-sample",
      });
      await invalidate();
      setSuccessText("OCR prefill version created.");
    });
  };

  const handlePdfDownload = async (sim: SimulationItem) => {
    await runAction(`pdf-sim-${sim.id}`, async () => {
      if (!session) return;
      await downloadSimulationPdf(session.token, sim.id);
      setSuccessText("PDF downloaded.");
    });
  };

  const handleArchive = async (sim: SimulationItem) => {
    await runAction(`delete-${sim.id}`, async () => {
      if (!session) return;
      await softDeleteSimulation(session.token, sim.id);
      await invalidate();
      setSuccessText("Simulation archived.");
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    await runAction("bulk-delete", async () => {
      if (!session) return;
      const result = await bulkDeleteSimulations(session.token, ids);
      await invalidate();
      setSuccessText(
        `Deleted ${result.succeeded} of ${result.total} simulation(s).`,
      );
    });
  };

  const handleBulkArchive = async (ids: string[]) => {
    await runAction("bulk-archive", async () => {
      if (!session) return;
      const result = await bulkArchiveSimulations(session.token, ids);
      await invalidate();
      setSuccessText(
        `Archived ${result.succeeded} of ${result.total} simulation(s).`,
      );
    });
  };

  const handleSaveAndCalculate = async (
    simId: string,
    payload: SimulationPayload,
  ): Promise<SimulationResults | null> => {
    if (!session) throw new Error("No session");
    // Save the payload first as a new version
    await updateSimulation(session.token, simId, {
      payloadJson: payload as Record<string, unknown>,
    });
    // Run calculation
    const calcResult = await calculateSimulation(session.token, simId);
    // Invalidate so list shows latest payloadJson
    await invalidate();
    // Update calcSim with fresh data so the panel can show latest payload
    setCalcSim((prev) =>
      prev?.id === simId
        ? {
            ...prev,
            payloadJson: {
              ...(payload as Record<string, unknown>),
              results: calcResult.results,
            },
          }
        : prev,
    );
    setSuccessText(
      `Cálculo completado — ${(calcResult.results.electricity?.length ?? 0) + (calcResult.results.gas?.length ?? 0)} productos evaluados.`,
    );
    return calcResult.results;
  };

  return {
    simulations,
    loading,
    busyAction,
    errorText,
    successText,
    clearFeedback,
    refresh,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    sortColumn,
    sortDir,
    setSort,
    showArchived,
    setShowArchived,
    filterSearch,
    setFilterSearch,
    filterOwnerUserId,
    setFilterOwnerUserId,
    filterClientId,
    setFilterClientId,
    filterCups,
    setFilterCups,
    filterStatus,
    setFilterStatus,
    applyFilters,
    filtersAppliedAt,
    clientName,
    setClientName,
    clientId,
    setClientId,
    cups,
    setCups,
    offerType,
    setOfferType,
    expiresDays,
    setExpiresDays,
    cupsValidation,
    cupsValidationBusy,
    handleValidateCups,
    handleCreateSimulation,
    selectedSimulationId,
    editSimulationStatus,
    editSimulationExpiry,
    editPayloadJson,
    openSimulationEditor,
    closeSimulationEditor,
    setEditSimulationStatus,
    setEditSimulationExpiry,
    setEditPayloadJson,
    handleUpdateSimulation,
    handleShare,
    handleClone,
    handleRotatePin,
    handleOcrPrefill,
    handlePdfDownload,
    handleArchive,
    handleBulkDelete,
    handleBulkArchive,
    handleSaveAndCalculate,
    calcSim,
    openCalcPanel,
    closeCalcPanel,
    simulationStatusTone,
    formatDate,
  };
}