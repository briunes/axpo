type SimulationPdfPayload = {
  selectedOffer?: {
    productKey?: string;
    commodity?: "ELECTRICITY" | "GAS";
  };
  results?: {
    electricity?: Array<{ productKey: string; productLabel?: string | null }>;
    gas?: Array<{ productKey: string; productLabel?: string | null }>;
  };
  productName?: string;
};

type SimulationPdfSource = {
  id: string;
  referenceNumber?: string | null;
  client?: { name?: string | null } | null;
  payloadJson?: SimulationPdfPayload | null;
};

const sanitizeFilenamePart = (
  value: string | null | undefined,
  fallback: string,
): string => {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized || fallback;
};

export const resolveSimulationProductName = (
  payload: SimulationPdfPayload | null | undefined,
): string | null => {
  if (!payload) return null;

  const selectedOffer = payload.selectedOffer;
  const results = payload.results;

  if (selectedOffer?.productKey) {
    const selectedResults =
      selectedOffer.commodity === "GAS" ? results?.gas : results?.electricity;
    const matched = selectedResults?.find(
      (result) => result.productKey === selectedOffer.productKey,
    );

    if (matched?.productLabel) {
      return matched.productLabel;
    }
  }

  return (
    results?.electricity?.[0]?.productLabel ??
    results?.gas?.[0]?.productLabel ??
    payload.productName ??
    null
  );
};

export const buildSimulationPdfFilename = ({
  productName,
  clientName,
  simulationCode,
  prefix = "simulation",
}: {
  productName?: string | null;
  clientName?: string | null;
  simulationCode?: string | null;
  prefix?: string;
}): string => {
  const safePrefix = sanitizeFilenamePart(prefix, "simulation");
  const safeProductName = sanitizeFilenamePart(productName, "product");
  const safeClientName = sanitizeFilenamePart(clientName, "client");
  const safeSimulationCode = sanitizeFilenamePart(simulationCode, "code");

  return `${safePrefix}-${safeProductName}-${safeClientName}-${safeSimulationCode}.pdf`;
};

export const buildSimulationPdfFilenameFromSimulation = (
  simulation: SimulationPdfSource,
  options?: {
    productName?: string | null;
    prefix?: string;
  },
): string => {
  const productName =
    options?.productName ??
    resolveSimulationProductName(simulation.payloadJson);

  return buildSimulationPdfFilename({
    prefix: options?.prefix,
    productName,
    clientName: simulation.client?.name,
    simulationCode: simulation.referenceNumber ?? simulation.id,
  });
};
