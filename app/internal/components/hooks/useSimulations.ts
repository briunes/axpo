"use client";

import { useCallback, useState } from "react";
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
  type CupsValidationResult,
  type SimulationItem,
} from "../../lib/internalApi";
import type { SimulationPayload, SimulationResults } from "@/domain/types";
import type { SessionState } from "../../lib/authSession";

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
  refresh: () => Promise<void>;
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
): SimulationsActions {
  const [simulations, setSimulations] = useState<SimulationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

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

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const items = await listSimulations(session.token);
      setSimulations(items.filter((item) => !item.isDeleted));
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Could not load simulations.",
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

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
      await refresh();
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
      await refresh();
      setSuccessText("Simulation updated.");
      setSelectedSimulationId(null);
    });
  };

  const handleShare = async (sim: SimulationItem): Promise<SimulationItem> => {
    if (!session) throw new Error("No session.");
    const shared = await shareSimulation(session.token, sim.id);
    await refresh();
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
      await refresh();
      setSuccessText("Simulation cloned.");
    });
  };

  const handleRotatePin = async (sim: SimulationItem) => {
    await runAction(`rotate-sim-pin-${sim.id}`, async () => {
      if (!session) return;
      await rotateSimulationPinSnapshot(session.token, sim.id);
      await refresh();
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
      await refresh();
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
      await refresh();
      setSuccessText("Simulation archived.");
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
    // Refresh list so payloadJson is up to date
    await refresh();
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
    handleSaveAndCalculate,
    calcSim,
    openCalcPanel,
    closeCalcPanel,
    simulationStatusTone,
    formatDate,
  };
}
