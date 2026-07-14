import { after, NextRequest, NextResponse } from "next/server";
import { del, get } from "@vercel/blob";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { prisma } from "@/infrastructure/database/prisma";
import {
  configurePdfJsWorker,
  convertPdfToImages,
  OCR_MAX_PDF_PAGES,
  OCR_PDF_RENDER_SCALE,
} from "@/lib/pdfToImage";
import { extractPdfWithOpenDataLoader } from "@/lib/opendataloaderPdfExtraction";
import {
  getBedrockRuntimeBaseUrl,
  isBedrockMantleProvider,
  isOpenAiCompatibleProvider,
  resolveAiConfigFromSystemConfig,
} from "@/application/lib/aiConfig";
import {
  getInvoiceContentType,
  isInvoiceFileName,
  isVercelBlobUrl,
} from "@/infrastructure/invoices/invoiceUpload";
import {
  getConfiguredMaxUploadFileSizeBytes,
  getConfiguredMaxUploadFileSizeMb,
} from "@/application/config/uploadLimits";

const OCR_DEBUG_LOGS =
  process.env.NODE_ENV !== "production" ||
  process.env.OCR_DEBUG_LOGS === "true";

const OCR_PERF_LOGS =
  process.env.OCR_PERF_LOGS === "true" ||
  process.env.APP_ENV === "preview" ||
  process.env.APP_ENV === "dev";

const debugOcrLog = (...args: unknown[]) => {
  if (OCR_DEBUG_LOGS) console.log(...args);
};

const perfOcrLog = (...args: unknown[]) => {
  if (OCR_PERF_LOGS) console.info(...args);
};

const ocrDebugSnippet = (value: string, length = 500): string | undefined =>
  OCR_DEBUG_LOGS ? value.substring(0, length) : undefined;

const isAnthropicBedrockRuntime = (
  provider: string,
  baseUrl?: string | null,
): boolean =>
  provider === "aws-bedrock-anthropic" ||
  (provider === "anthropic" &&
    typeof baseUrl === "string" &&
    /bedrock-runtime\.[^.]+\.amazonaws\.com/.test(baseUrl));

const isNvidiaBedrockRuntime = (provider: string): boolean =>
  provider === "aws-bedrock-nvidia";

const getBedrockImageFormat = (
  mimeType: string,
): "png" | "jpeg" | "gif" | "webp" => {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  return "jpeg";
};

const OCR_BEDROCK_MULTI_IMAGE_MAX_DIMENSION_PX = 2000;
const OCR_BEDROCK_MULTI_IMAGE_MAX_COUNT = 20;
const OCR_BEDROCK_RESIZED_IMAGE_QUALITY = 82;

async function constrainImageForBedrock(image: {
  base64: string;
  mimeType: string;
}): Promise<{ base64: string; mimeType: string }> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const sourceBuffer = Buffer.from(image.base64, "base64");
    const source = await loadImage(sourceBuffer);

    const originalWidth = Math.max(1, Math.round(source.width));
    const originalHeight = Math.max(1, Math.round(source.height));
    const currentMaxDimension = Math.max(originalWidth, originalHeight);

    if (currentMaxDimension <= OCR_BEDROCK_MULTI_IMAGE_MAX_DIMENSION_PX) {
      return image;
    }

    const scale =
      OCR_BEDROCK_MULTI_IMAGE_MAX_DIMENSION_PX / currentMaxDimension;
    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(source as any, 0, 0, targetWidth, targetHeight);

    const resizedBase64 = (
      await canvas.encode("webp", OCR_BEDROCK_RESIZED_IMAGE_QUALITY)
    ).toString("base64");

    return { base64: resizedBase64, mimeType: "image/webp" };
  } catch (error) {
    console.warn(
      "Invoice extraction image resize skipped:",
      error instanceof Error ? error.message : error,
    );
    return image;
  }
}

/**
 * LLM Prompts for Invoice Data Extraction
 *
 * Separate prompts for electricity and gas invoices.
 * The correct one is selected based on the invoiceType detected in the provider-detection step.
 */
const INVOICE_EXTRACTION_PROMPT_ELECTRICITY = `You are an expert at extracting data from Spanish ELECTRICITY invoices.

IMPORTANT PRIORITY RULE — CLIENT CIF EXTRACTION

Spanish energy invoices often contain TWO CIF/NIF values:
1. the ENERGY COMPANY CIF
2. the CLIENT/HOLDER CIF

You MUST extract ONLY the CLIENT/HOLDER CIF.

NEVER extract the supplier/provider CIF.

EXAMPLE OF WRONG CIF:
"IBERDROLA CLIENTES, S.A.U. CIF A-95758389"
This is the ENERGY COMPANY CIF.
IGNORE IT.

EXAMPLE OF CORRECT CIF:
"CIF titular: B53572871"
This is the CLIENT CIF.
USE THIS VALUE.

When extracting the "cif" field:
- prioritize labels:
  - "CIF titular"
  - "NIF titular"
  - "CIF cliente"
  - "NIF cliente"
  - "Titular"
  - "Cliente"

- NEVER use CIF values:
  - near the logo
  - in the header
  - near supplier company names
  - near "IBERDROLA", "ENDESA", "NATURGY", "REPSOL", etc.

- If the invoice contains:
  - "CIF titular"
  AND
  - another CIF near the supplier name

ALWAYS use ONLY the "CIF titular" value.

For Iberdrola invoices:
the client CIF is usually located inside:
"INFORMACION ADICIONAL"

Example:
"CIF titular: B53572871"

Return:
"cif": "B53572871"

Extract ALL available information from the provided invoice and return it as a JSON object. Be thorough and precise.

CRITICAL BILLING PERIOD RULE:

Invoices may contain multiple unrelated dates:
- issue date
- payment date
- contract dates
- meter reading dates

For fechaInicio and fechaFin:
- prioritize the explicit billing period
- prioritize labels like:
  - "Periodo de facturación"
  - "Periodo facturado"
  - "Facturación desde/hasta"
  - "Desde / Hasta"

The correct billing period usually forms a continuous period of approximately:
- 28 to 31 days for monthly invoices

Example:
"Periodo de facturación: 01.03.2026 - 31.03.2026"

Return:
"fechaInicio": "2026-03-01"
"fechaFin": "2026-03-31"

NEVER use:
- invoice issue date
- payment due date
- contract expiration date
as billing period dates.

CRITICAL PERIOD IDENTIFICATION RULE (VERY IMPORTANT):

The invoice periods MUST be mapped using the ACTUAL printed period labels from the invoice.

NEVER assign values by order or position.

NEVER assume:
- first value = P1
- second value = P2
- third value = P3

ONLY use the explicit period identifier shown on the invoice.

2.0TD CONSUMPTION LABEL EXCEPTION:
When, and only when, the invoice explicitly prints tariff "2.0TD", treat the
printed energy-consumption labels as canonical period identifiers:
- "punta" = P1
- "llano" = P2
- "valle" = P3

This is allowed only for consumption values explicitly labeled with those
words (for example, "Los consumos han sido punta: ... llano: ... valle: ...").
Do not apply this mapping to meter readings, maximum demand, prices, power, or
unlabeled values. Do not use it unless "2.0TD" is explicitly printed.

Examples:

If the invoice shows:
- Periodo 2 → 1200 kWh
- Periodo 3 → 800 kWh
- Periodo 6 → 150 kWh

You MUST return:
{
  "consumoP2": 1200,
  "consumoP3": 800,
  "consumoP6": 150
}

You MUST NOT return:
{
  "consumoP1": 1200,
  "consumoP2": 800,
  "consumoP3": 150
}

The same rule applies to:
- consumoP1..P6
- potenciaP1..P6
- precioPotenciaP1..P6
- precioEnergiaP1..P6

If a period does NOT explicitly appear on the invoice:
- DO NOT create the field
- DO NOT infer it
- DO NOT shift another period into it

For example:
If only P2, P3 and P6 exist,
return ONLY:
- consumoP2
- consumoP3
- consumoP6

and OMIT:
- consumoP1
- consumoP4
- consumoP5

CRITICAL TARIFF EXTRACTION RULE (VERY IMPORTANT):

tarifaAcceso MUST ONLY be extracted from an EXPLICIT tariff label printed on the invoice.

NEVER infer tarifaAcceso from:
- number of periods
- existence of P4/P5/P6
- contracted powers
- energy periods
- industrial-looking layouts
- consumption tables

The ONLY valid source is an explicit field such as:
- "Peaje de acceso a la red (ATR)"
- "Tarifa de acceso"
- "Tarifa"
- "Tipo de tarifa"

Examples:

If the invoice explicitly says:
"Peaje de acceso a la red (ATR): 3.0TD"

You MUST return:
"tarifaAcceso": "3.0TD"

Even if:
- periods P1..P6 exist
- six power periods exist
- six energy periods exist

DO NOT convert 3.0TD into 6.1TD.

6.1TD must ONLY be returned if the invoice explicitly prints:
- "6.1TD"

If the invoice explicitly says 3.0TD anywhere,
ALWAYS prioritize that exact printed value.

CRITICAL FIELDS TO EXTRACT:

1. CLIENT/HOLDER INFORMATION:
   - cups: ⚠️ MANDATORY — CUPS code (Código Universal del Punto de Suministro). Look for the label "Identificación punto de suministro (CUPS)", "CUPS", or "Punto de suministro". The value ALWAYS starts with "ES" and is 20-22 characters long. It is often printed with spaces between groups (e.g. "ES 0021 0000 0046 0347 YE") — you MUST strip ALL spaces and return it as one continuous string (e.g. "ES0021000000460347YE"). IMPORTANT: do NOT confuse with barcodes or long numeric reference codes printed elsewhere — only use the value next to the explicit CUPS label. Never skip this field.
   - nombreTitular: Full name of the invoice holder/titular
   - personaContacto: Contact person name
   - direccion: ⚠️ This MUST be the CUPS supply point address — i.e. the address of the metering point / installation.
     Look in sections labeled:
     - "Datos punto de suministro"
     - "Dirección de suministro"
     - "Punto de suministro"
     - "Dirección del punto de suministro"
     This is NOT the client's billing/postal address. It is the physical location where the electricity or gas meter is installed.
     Extract it as a single string.
   - clienteAddress: The client's main billing / invoicing address (dirección de facturación del titular).
     Look in sections labeled:
     - "Datos del titular"
     - "Datos facturación"
     - "Dirección de facturación"
     - "Titular"
     Extract as a structured object with the following sub-fields:
       - street: Street name and number (e.g. "AV DE LA LIBERTAD, 2 PTA. BJ")
       - city: City name (e.g. "TORREVIEJA")
       - postalCode: Postal code (e.g. "03180")
       - province: Province or region (e.g. "ALICANTE")
       - country: ISO 3166-1 alpha-2 country code. For Spanish invoices always use "ES".
     If the billing address is the same section as the supply address, still extract it here. Always include all sub-fields, using empty string "" if a sub-field is not found.
   - comercializadorActual: Current energy marketer/supplier name
   - cif: Tax ID (CIF/NIF) of the CLIENT/HOLDER only.
     NEVER use the supplier/provider CIF.
     Example of WRONG value:
     "A-95758389" (Iberdrola provider CIF)
     Example of CORRECT value:
     "B53572871" (CIF titular)

2. TARIFF AND ZONE:
   - tarifaAcceso: ⚠️ MANDATORY — Access tariff.

     Look ONLY for explicit labels:
     - "Peaje de acceso a la red (ATR)"
     - "Tarifa de acceso"
     - "Tarifa"
     - "Tipo de tarifa"

     Valid electricity values are ONLY:
     - "2.0TD"
     - "3.0TD"
     - "6.1TD"

     IMPORTANT:
     3.0TD and 6.1TD BOTH commonly contain P1-P6 periods.

     Therefore:
     - the number of periods MUST NEVER be used to determine the tariff
     - the tariff MUST ONLY come from the explicitly printed tariff label

     Valid gas values are:
     - "RL.1"
     - "RL.2"
     - "RL.3"
     - etc.

     Never skip this field.

   - zonaGeografica: Geographic zone ("Peninsula", "Baleares", "Canarias" for electricity, or specific gas zone)
   - perfilCarga: Load profile ("NORMAL", "DIURNO" for electricity)

3. BILLING PERIOD:
   - fechaInicio: Start date of billing period (format: YYYY-MM-DD)
   - fechaFin: End date of billing period (format: YYYY-MM-DD)

4. ENERGY CONSUMPTION (Consumo de Energía):
   For electricity, extract by period:
   - consumoP1: Consumption in period P1 (kWh)
   - consumoP2: Consumption in period P2 (kWh)
   - consumoP3: Consumption in period P3 (kWh)
   - consumoP4: Consumption in period P4 (kWh)
   - consumoP5: Consumption in period P5 (kWh)
   - consumoP6: Consumption in period P6 (kWh)

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - For an explicitly printed 2.0TD tariff, the consumption labels "punta",
     "llano", and "valle" explicitly map to P1, P2, and P3 respectively.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

5. CONTRACTED POWER (Potencia Contratada - electricity only):
   - potenciaP1: Contracted power P1 (kW)
   - potenciaP2: Contracted power P2 (kW)
   - potenciaP3: Contracted power P3 (kW)
   - potenciaP4: Contracted power P4 (kW)
   - potenciaP5: Contracted power P5 (kW)
   - potenciaP6: Contracted power P6 (kW)

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

6. FINANCIAL INFORMATION:
   - facturaActual: Total invoice amount including taxes (€)
   - excesoPotencia: Total excess power charge ("Exceso de potencia" / "Excesos de potencia") in €
   - reactiva: Reactive energy charges (€)
   - alquiler: Equipment rental charges (€)
   - otrosCargos: Other charges/concepts (€)

   CURRENT INVOICE BREAKDOWN AMOUNTS — REQUIRED WHEN VISIBLE:
   These are euro totals from "Detalle de la factura", "Detalle factura",
   "Conceptos facturados", or equivalent sections. They are NOT unit prices.
   - importePotencia: the subtotal/total shown for the "Potencia" group in €.
     If there are multiple Potencia rows, return the printed group total if visible;
     otherwise sum only the Potencia row amounts. Do NOT use €/kW unit prices here.
   - importeEnergia: the subtotal/total shown for the "Energía" group in €.
     If there are multiple energy rows, return the printed group total if visible;
     otherwise sum only the Energía row amounts. Do NOT use €/kWh unit prices here.
   - importeImpuestoElectrico: euro amount from the electricity tax row, usually
     labeled "Impuesto electricidad", "Impuesto especial electricidad", or similar.
     Do NOT return the tax rate here.
   - importeIva: euro amount from the IVA/IGIC row, usually labeled "IVA normal",
     "IVA", "IGIC", or similar. Do NOT return the IVA rate here.
   - For Endesa-style detail blocks where the left label has a bold subtotal at the
     far right (for example "Potencia ... 78,36 €", "Energía ... 497,88 €",
     "Impuestos ... 125,40 €", then rows "Impuesto electricidad ... 2,89 €"
     and "IVA normal 21% ... 122,51 €"), return:
     importePotencia = 78.36, importeEnergia = 497.88,
     importeImpuestoElectrico = 2.89, importeIva = 122.51.
   - If the invoice image/text does not show one of these amounts, return null for
     that field instead of estimating it.

7. CURRENT SUPPLIER POWER UNIT PRICES:
   - precioPotenciaP1
   - precioPotenciaP2
   - precioPotenciaP3
   - precioPotenciaP4
   - precioPotenciaP5
   - precioPotenciaP6

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

8. CURRENT SUPPLIER ENERGY UNIT PRICES:
   - precioEnergiaP1
   - precioEnergiaP2
   - precioEnergiaP3
   - precioEnergiaP4
   - precioEnergiaP5
   - precioEnergiaP6

   STRICT PERIOD MAPPING:
   - Map values ONLY to their explicitly labeled period number.
   - NEVER remap periods sequentially.
   - NEVER compress gaps.
   - NEVER infer missing periods.
   - Missing periods must be omitted entirely.

9. GAS SPECIFIC:
   - telemedida: Remote metering ("SI" or "NO")

10. TYPE DETECTION:
   - invoiceType: Determine if "ELECTRICITY", "GAS", or "BOTH"

11. TAX RATES (extract ONLY if explicitly printed on the invoice):
   - ivaTasa: IVA / VAT rate as a PERCENTAGE number (e.g. 21 for 21%, 10 for 10%).
     Look for labels: "IVA", "I.V.A.", "Impuesto sobre el Valor Añadido".
     For Canary Islands invoices look for "IGIC" instead — extract that value into ivaTasa.
     NEVER infer or assume this value. Only extract if printed.
   - impuestoElectricoTasa: Electricity tax rate as a PERCENTAGE number (e.g. 5.11269 for 5.11269%).
     Look for labels: "Impuesto eléctrico", "Impuesto especial electricidad", "I.E. electricidad",
     "Impuesto sobre la electricidad", "Electricidad s/ base".
     NEVER infer or assume this value. Only extract if printed.

   IMPORTANT:
   - Extract as plain percentage numbers, NOT as decimals (e.g. 21, not 0.21).
   - If the rate is not explicitly printed, return null for these fields.

IMPORTANT NOTES:
- Convert all dates to YYYY-MM-DD format
- Extract numeric values without currency symbols or units
- Convert Spanish decimal commas to standard decimals
- ALWAYS return the COMPLETE JSON object with ALL fields listed below, even if a field is empty or not found. Use null for missing numeric/string fields and "" for missing string sub-fields inside clienteAddress.
- Return ONLY a valid JSON object. No markdown, no code fences, no explanation — just the raw JSON.

You MUST always return a JSON that exactly matches this structure (all keys present):

{
  "cups": "ES0021000000000000XX",
  "nombreTitular": "EMPRESA EJEMPLO, S.L.",
  "personaContacto": "",
  "cif": "B12345678",
  "direccion": "CALLE SUMINISTRO 1, 2º A",
  "clienteAddress": {
    "street": "CALLE FACTURACIÓN 2, PTA. BJ",
    "city": "MADRID",
    "postalCode": "28001",
    "province": "MADRID",
    "country": "ES"
  },
  "comercializadorActual": "NOMBRE COMERCIALIZADOR",
  "tarifaAcceso": "3.0TD",
  "zonaGeografica": "Peninsula",
  "perfilCarga": "NORMAL",
  "fechaInicio": "2025-10-01",
  "fechaFin": "2025-10-31",
  "consumoP1": null,
  "consumoP2": null,
  "consumoP3": null,
  "consumoP4": null,
  "consumoP5": null,
  "consumoP6": null,
  "consumoAnual": null,
  "potenciaP1": null,
  "potenciaP2": null,
  "potenciaP3": null,
  "potenciaP4": null,
  "potenciaP5": null,
  "potenciaP6": null,
  "precioPotenciaP1": null,
  "precioPotenciaP2": null,
  "precioPotenciaP3": null,
  "precioPotenciaP4": null,
  "precioPotenciaP5": null,
  "precioPotenciaP6": null,
  "precioEnergiaP1": null,
  "precioEnergiaP2": null,
  "precioEnergiaP3": null,
  "precioEnergiaP4": null,
  "precioEnergiaP5": null,
  "precioEnergiaP6": null,
  "facturaActual": null,
  "excesoPotencia": null,
  "reactiva": null,
  "alquiler": null,
  "otrosCargos": null,
  "importePotencia": null,
  "importeEnergia": null,
  "importeImpuestoElectrico": null,
  "importeIva": null,
  "ivaTasa": null,
  "impuestoElectricoTasa": null,
  "telemedida": "",
  "invoiceType": "ELECTRICITY"
}`;

/**
 * Default prompt for GAS invoices.
 */
const INVOICE_EXTRACTION_PROMPT_GAS = `You are an expert at extracting data from Spanish GAS invoices.

IMPORTANT PRIORITY RULE — CLIENT CIF EXTRACTION

Spanish energy invoices often contain TWO CIF/NIF values:
1. the ENERGY COMPANY CIF
2. the CLIENT/HOLDER CIF

You MUST extract ONLY the CLIENT/HOLDER CIF.
NEVER extract the supplier/provider CIF.

When extracting the "cif" field prioritize labels: "CIF titular", "NIF titular", "CIF cliente", "NIF cliente", "Titular", "Cliente".
NEVER use CIF values near the logo, header, or supplier company names.

CRITICAL BILLING PERIOD RULE:

For fechaInicio and fechaFin prioritize labels like:
- "Periodo de facturación", "Periodo facturado", "Facturación desde/hasta", "Desde / Hasta"

The correct billing period is usually ~28–31 days for monthly invoices.
NEVER use invoice issue date, payment due date, or contract expiration date.

CRITICAL FIELDS TO EXTRACT:

1. CLIENT/HOLDER INFORMATION:
   - cups: ⚠️ MANDATORY — CUPS gas code. Starts with "ES" and is 20-22 chars long. Strip all spaces.
   - nombreTitular: Full name of the invoice holder/titular
   - personaContacto: Contact person name
   - direccion: Supply point address (where the gas meter is installed). Look in "Datos punto de suministro", "Dirección de suministro".
   - clienteAddress: Billing address as object with: street, city, postalCode, province, country (use "ES").
   - comercializadorActual: Current gas supplier/marketer name
   - cif: Tax ID (CIF/NIF) of the CLIENT/HOLDER only.

2. TARIFF AND ZONE:
   - tarifaAcceso: ⚠️ MANDATORY — Gas access tariff. You MUST return one of these exact values:
     "RL01", "RL02", "RL03", "RL04", "RL05", "RL06",
     "RLPS1", "RLPS2", "RLPS3", "RLPS4", "RLPS5", "RLPS6"
     Match the tariff printed on the invoice to the closest option (e.g. "RL.2" or "RL2" → "RL02"). Never skip.
   - zonaGeografica: Geographic zone (e.g. "Peninsula", "Baleares", "Canarias", or specific gas zone)
   - perfilCarga: Leave null for gas

3. BILLING PERIOD:
   - fechaInicio: Start date (YYYY-MM-DD)
   - fechaFin: End date (YYYY-MM-DD)

4. GAS CONSUMPTION:
   - consumoTotal: Total gas consumption in kWh or m³ as printed on the invoice
   - consumoAnual: Always return null for gas OCR extraction. Do NOT copy consumoTotal into consumoAnual.
   NOTE: Gas invoices do NOT have period-based consumption (P1..P6). Leave consumoP1..P6 as null.

5. FINANCIAL INFORMATION:
   - facturaActual: Total invoice amount including taxes (€)
   - alquiler: Equipment/meter rental charges (€)
   - otrosCargos: Other charges (€)

   CURRENT GAS INVOICE BREAKDOWN AMOUNTS — REQUIRED WHEN VISIBLE:
   These are euro totals from "Detalle de la factura", "Conceptos facturados",
   or equivalent gas invoice detail sections. They are NOT unit prices.
   - importeTerminoFijo: subtotal/total shown for the fixed term / "Término fijo" group in €.
   - importeTerminoVariable: subtotal/total shown for the gas energy / variable term group in €.
   - importeImpuestoHidrocarburos: euro amount from the hydrocarbon tax row in €.
     Do NOT return the hydrocarbon unit rate here.
   - importeIva: euro amount from the IVA/IGIC row in €.
   - If the invoice image/text does not show one of these amounts, return null for
     that field instead of estimating it.

6. GAS-SPECIFIC:
   - telemedida: Remote metering ("SI" or "NO")
   - impuestoHidrocarburo: Hydrocarbon tax UNIT RATE in €/kWh, if shown.
     This is NOT the total euro amount charged for the tax.
     Example: in a row like "99.393 kWh 0,002340 232,58 Eur", extract 0.002340, NEVER 232.58.
     Example: if the invoice says "(0,65 Eur/Gj)" and the configured allowed €/kWh option is 0.00234, return 0.00234.

7. TAX RATES (only if explicitly printed):
   - ivaTasa: IVA/VAT rate as a PERCENTAGE number (e.g. 21). Look for "IVA", "I.V.A.". For Canary Islands look for "IGIC".
   - impuestoHidrocarburo: Hydrocarbon/gas tax UNIT RATE in €/kWh if shown.
     Look for "Impuesto sobre Hidrocarburos", "I.H.", "Imp. Hidrocarburos".
     If the invoice prints both a unit price and an importe/total, use the unit price column.
     If the invoice prints a rate in Eur/Gj plus an equivalence to kWh, convert it to €/kWh only when it matches one configured allowed option.

IMPORTANT NOTES:
- Convert all dates to YYYY-MM-DD format
- Extract numeric values without currency symbols or units
- Convert Spanish decimal commas to standard decimals
- Return ONLY a valid JSON object. No markdown, no code fences, no explanation.
- ALWAYS return the COMPLETE JSON with all keys, using null for missing fields.

You MUST always return a JSON that exactly matches this structure (all keys present):

{
  "cups": "ES0000000000000000XX",
  "nombreTitular": "EMPRESA EJEMPLO, S.L.",
  "personaContacto": "",
  "cif": "B12345678",
  "direccion": "CALLE SUMINISTRO 1, 2º A",
  "clienteAddress": {
    "street": "CALLE FACTURACIÓN 2, PTA. BJ",
    "city": "MADRID",
    "postalCode": "28001",
    "province": "MADRID",
    "country": "ES"
  },
  "comercializadorActual": "NOMBRE COMERCIALIZADOR",
  "tarifaAcceso": "RL.2",
  "zonaGeografica": "Peninsula",
  "perfilCarga": null,
  "fechaInicio": "2025-10-01",
  "fechaFin": "2025-10-31",
  "consumoP1": null,
  "consumoP2": null,
  "consumoP3": null,
  "consumoP4": null,
  "consumoP5": null,
  "consumoP6": null,
  "consumoAnual": null,
  "consumoTotal": null,
  "potenciaP1": null,
  "potenciaP2": null,
  "potenciaP3": null,
  "potenciaP4": null,
  "potenciaP5": null,
  "potenciaP6": null,
  "precioPotenciaP1": null,
  "precioPotenciaP2": null,
  "precioPotenciaP3": null,
  "precioPotenciaP4": null,
  "precioPotenciaP5": null,
  "precioPotenciaP6": null,
  "precioEnergiaP1": null,
  "precioEnergiaP2": null,
  "precioEnergiaP3": null,
  "precioEnergiaP4": null,
  "precioEnergiaP5": null,
  "precioEnergiaP6": null,
  "facturaActual": null,
  "excesoPotencia": null,
  "reactiva": null,
  "alquiler": null,
  "otrosCargos": null,
  "importeTerminoFijo": null,
  "importeTerminoVariable": null,
  "importeImpuestoHidrocarburos": null,
  "importeIva": null,
  "ivaTasa": null,
  "impuestoElectricoTasa": null,
  "impuestoHidrocarburo": null,
  "telemedida": "",
  "invoiceType": "GAS"
}`;

/**
 * @swagger
 * /api/v1/internal/invoices/extract:
 *   post:
 *     tags: [Invoices]
 *     summary: Extract data from invoice using LLM
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Extracted invoice data
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  const requestStartTime = Date.now();
  const phaseTimings: Record<string, number> = {};

  const recordPhase = <T>(name: string, startedAt: number, value: T): T => {
    phaseTimings[name] = Date.now() - startedAt;
    return value;
  };

  const timed = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now();
    try {
      return await task();
    } finally {
      phaseTimings[name] = Date.now() - startedAt;
    }
  };

  type OcrPersistedFile = {
    fileName: string;
    fileType?: string | null;
    fileSizeBytes?: number;
    fileData: Buffer;
  };
  type LoadedInvoiceFile = OcrPersistedFile & {
    name: string;
    type: string;
    size: number;
  };

  type ParsedInvoiceRequest = {
    files: LoadedInvoiceFile[];
    providerId: string | null;
    invoiceTypeParam: string | null;
    invoiceCountParam: number | null;
    temporaryBlobUrls: string[];
  };
  const maxUploadFileSizeMb = await getConfiguredMaxUploadFileSizeMb();
  const maxUploadFileSizeBytes = await getConfiguredMaxUploadFileSizeBytes();

  const loadInvoiceRequest = async (): Promise<ParsedInvoiceRequest> => {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const payload = (await timed("jsonBodyMs", () =>
        req.json().catch(() => ({})),
      )) as {
        files?: Array<{
          blobUrl?: string;
          fileName?: string;
          fileType?: string;
          fileSizeBytes?: number;
        }>;
        providerId?: string | null;
        invoiceType?: string | null;
        invoiceCount?: number | null;
      };
      const inputFiles = Array.isArray(payload.files) ? payload.files : [];
      const files: LoadedInvoiceFile[] = [];
      const temporaryBlobUrls: string[] = [];

      for (const input of inputFiles) {
        if (!input.blobUrl || !isVercelBlobUrl(input.blobUrl)) {
          throw new Error("Invalid invoice blob URL");
        }
        const fileName = (input.fileName || "invoice").replace(/[\r\n"]/g, "_");
        if (!isInvoiceFileName(fileName)) {
          throw new Error("Invoice must be a PDF, JPEG, PNG, or WebP file");
        }

        const blob = await timed("blobGetMs", () =>
          get(input.blobUrl!, {
            access: "private",
            useCache: false,
          }),
        );
        if (!blob || blob.statusCode !== 200) {
          throw new Error("Uploaded invoice file could not be retrieved");
        }
        if (blob.blob.size > maxUploadFileSizeBytes) {
          throw new Error(
            `Invoice file exceeds the ${maxUploadFileSizeMb} MB upload limit`,
          );
        }

        const buffer = Buffer.from(
          await new Response(blob.stream).arrayBuffer(),
        );
        const fileType =
          input.fileType || getInvoiceContentType({ name: fileName });
        files.push({
          name: fileName,
          type: fileType,
          size: input.fileSizeBytes ?? buffer.length,
          fileName,
          fileType,
          fileSizeBytes: input.fileSizeBytes ?? buffer.length,
          fileData: buffer,
        });
        temporaryBlobUrls.push(input.blobUrl);
      }

      return {
        files,
        providerId: payload.providerId ?? null,
        invoiceTypeParam: payload.invoiceType ?? null,
        invoiceCountParam:
          typeof payload.invoiceCount === "number" ? payload.invoiceCount : null,
        temporaryBlobUrls,
      };
    }

    const formData = await timed("formDataMs", () => req.formData());
    const requestFiles = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File);
    const oversizedFile = requestFiles.find(
      (file) => file.size > maxUploadFileSizeBytes,
    );
    if (oversizedFile) {
      throw new Error(
        `Invoice file exceeds the ${maxUploadFileSizeMb} MB upload limit`,
      );
    }
    const files = await Promise.all(
      requestFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          fileName: file.name,
          fileType: file.type || null,
          fileSizeBytes: file.size,
          fileData: buffer,
        };
      }),
    );

    return {
      files,
      providerId: formData.get("providerId") as string | null,
      invoiceTypeParam: formData.get("invoiceType") as string | null,
      invoiceCountParam:
        Number(formData.get("invoiceCount")) > 0
          ? Number(formData.get("invoiceCount"))
          : null,
      temporaryBlobUrls: [],
    };
  };

  const persistOcrLogFiles = async (
    ocrLogId: string,
    files: OcrPersistedFile[],
  ) => {
    if (files.length === 0) return;
    await (prisma as any).ocrLogFile.createMany({
      data: files.map((file) => ({
        ocrLogId,
        fileName: file.fileName,
        fileType: file.fileType ?? null,
        fileSizeBytes: file.fileSizeBytes ?? file.fileData.length,
        fileData: file.fileData,
      })),
    });
  };

  const updateOcrLogDeferredFields = async (
    ocrLogId: string,
    data: {
      promptText?: string;
      rawResponseSnippet?: string;
    },
  ) => {
    const updateData: Record<string, string> = {};
    if (data.promptText !== undefined) updateData.promptText = data.promptText;
    if (data.rawResponseSnippet !== undefined) {
      updateData.rawResponseSnippet = data.rawResponseSnippet;
    }
    if (Object.keys(updateData).length === 0) return;
    await prisma.ocrLog.update({
      where: { id: ocrLogId },
      data: updateData,
    });
  };

  // Helper: persist an OCR log entry (never throws)
  const saveOcrLog = async (data: {
    status: string;
    durationMs?: number;
    provider?: string;
    model?: string;
    baseUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
    pageCount?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    extractedFields?: any;
    fieldsExtracted?: number;
    errorMessage?: string;
    errorType?: string;
    httpStatusCode?: number;
    rawResponseSnippet?: string;
    promptText?: string;
    metadata?: any;
    files?: File[];
    persistedFiles?: OcrPersistedFile[];
    deferFiles?: boolean;
    deferDebugFields?: boolean;
  }) => {
    try {
      const logStartedAt = Date.now();
      const uploadedFiles =
        data.files && data.files.length > 0
          ? await Promise.all(
              data.files.map(async (file) => ({
                fileName: file.name,
                fileType: file.type || null,
                fileSizeBytes: file.size,
                fileData: Buffer.from(await file.arrayBuffer()),
              })),
            )
          : [];

      const persistedFiles = [
        ...uploadedFiles,
        ...(data.persistedFiles ?? []).map((f) => ({
          fileName: f.fileName,
          fileType: f.fileType ?? null,
          fileSizeBytes: f.fileSizeBytes ?? f.fileData.length,
          fileData: f.fileData,
        })),
      ];

      const created = await prisma.ocrLog.create({
        data: {
          userId: auth.userId,
          userEmail: auth.email,
          type: "INVOICE_EXTRACTION",
          status: data.status,
          durationMs: data.durationMs,
          provider: data.provider ?? "unknown",
          model: data.model ?? "unknown",
          baseUrl: data.baseUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSizeBytes: data.fileSizeBytes,
          pageCount: data.pageCount,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          extractedFields: data.extractedFields ?? undefined,
          fieldsExtracted: data.fieldsExtracted,
          errorMessage: data.errorMessage,
          errorType: data.errorType,
          httpStatusCode: data.httpStatusCode,
          rawResponseSnippet: data.deferDebugFields
            ? undefined
            : data.rawResponseSnippet,
          promptText: data.deferDebugFields ? undefined : data.promptText,
          metadata: {
            ...(data.metadata ?? {}),
            timings: {
              ...phaseTimings,
              totalBeforeLogMs: Date.now() - requestStartTime,
            },
          },
        },
      });

      phaseTimings[`ocrLog.${data.status.toLowerCase()}.rowMs`] =
        Date.now() - logStartedAt;

      if (persistedFiles.length > 0) {
        const persistFiles = async () => {
          const filesStartedAt = Date.now();
          try {
            await persistOcrLogFiles(created.id, persistedFiles);
            perfOcrLog("[Invoice extraction timing] OCR log files saved", {
              ocrLogId: created.id,
              fileCount: persistedFiles.length,
              durationMs: Date.now() - filesStartedAt,
            });
          } catch (err) {
            console.error("[OCR Log] Failed to save log files:", err);
          }
        };

        if (data.deferFiles) {
          after(persistFiles);
        } else {
          await persistFiles();
        }
      }

      if (
        data.deferDebugFields &&
        (data.promptText !== undefined || data.rawResponseSnippet !== undefined)
      ) {
        after(async () => {
          const debugFieldsStartedAt = Date.now();
          try {
            await updateOcrLogDeferredFields(created.id, {
              promptText: data.promptText,
              rawResponseSnippet: data.rawResponseSnippet,
            });
            perfOcrLog("[Invoice extraction timing] OCR debug fields saved", {
              ocrLogId: created.id,
              durationMs: Date.now() - debugFieldsStartedAt,
            });
          } catch (err) {
            console.error(
              "[OCR Log] Failed to save deferred debug fields:",
              err,
            );
          }
        });
      }

      return created;
    } catch (err) {
      console.error("[OCR Log] Failed to save log:", err);
      return null;
    }
  };

  // Get LLM configuration
  const config = await timed("configMs", () => prisma.systemConfig.findFirst());

  if (!(config as any)?.llmEnabled) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: "unknown",
      model: "unknown",
      errorMessage: "LLM features are not enabled",
      errorType: "CONFIG_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message:
          "LLM features are not enabled. Please enable them in system configuration.",
      },
      { status: 400 },
    );
  }

  const aiConfig = resolveAiConfigFromSystemConfig(
    config as Record<string, any>,
    "invoiceExtraction",
    { defaultTemperature: 0.1, defaultMaxTokens: 2000 },
  );
  const llmBaseUrl = aiConfig?.baseUrl;
  const llmModelName = aiConfig?.modelName;
  const llmProvider = aiConfig?.provider || "unknown";
  const llmApiKey = aiConfig?.apiKey;
  const llmTemperature = aiConfig?.temperature ?? 0.1;
  const llmMaxTokens = aiConfig?.maxTokens ?? 2000;

  debugOcrLog("=== INVOICE EXTRACTION REQUEST ===");
  debugOcrLog("Provider:", llmProvider);
  debugOcrLog("Model:", llmModelName);
  debugOcrLog("Temperature:", llmTemperature);
  debugOcrLog("Max Tokens:", llmMaxTokens);
  debugOcrLog("===================================");

  if (!llmBaseUrl || !llmModelName) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName ?? "unknown",
      baseUrl: llmBaseUrl,
      errorMessage:
        "LLM is not properly configured. Please configure the base URL and model in system settings.",
      errorType: "CONFIG_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message:
          "LLM is not properly configured. Please configure the base URL and model in system settings.",
      },
      { status: 400 },
    );
  }

  const {
    files: requestFiles,
    providerId,
    invoiceTypeParam,
    invoiceCountParam,
    temporaryBlobUrls,
  } = await loadInvoiceRequest();
  const file = requestFiles[0];
  const invoiceType: "ELECTRICITY" | "GAS" | null =
    invoiceTypeParam === "ELECTRICITY" || invoiceTypeParam === "GAS"
      ? invoiceTypeParam
      : null;

  const cleanupTemporaryBlobs = () => {
    for (const url of temporaryBlobUrls) {
      del(url).catch(() => {});
    }
  };

  // Select the appropriate default prompt based on invoice type
  const defaultPrompt =
    invoiceType === "GAS"
      ? INVOICE_EXTRACTION_PROMPT_GAS
      : INVOICE_EXTRACTION_PROMPT_ELECTRICITY;

  // Load provider-specific prompt if a providerId was supplied
  let activePrompt = defaultPrompt;
  let invoiceProviderName: string | null = null;
  if (providerId) {
    try {
      const providerRecord = (await timed("providerPromptMs", () =>
        (prisma as any).invoiceProviderPrompt.findUnique({
          where: { id: providerId },
        }),
      )) as any;
      if (providerRecord) {
        invoiceProviderName = providerRecord.name as string;
        // Pick the per-commodity prompt first, fall back to legacy generic prompt
        const commodityPrompt =
          invoiceType === "GAS"
            ? providerRecord.promptGas
            : providerRecord.promptElectricity;
        const chosenPrompt =
          commodityPrompt?.trim().length > 0
            ? commodityPrompt
            : providerRecord.prompt?.trim().length > 0
              ? providerRecord.prompt
              : null;
        if (chosenPrompt) {
          activePrompt = chosenPrompt;
          debugOcrLog(
            `Using provider-specific ${invoiceType ?? "generic"} prompt for: ${providerRecord.name}`,
          );
        }
      }
    } catch (err) {
      console.warn(
        "Failed to load provider prompt, falling back to default:",
        err,
      );
    }
  }

  // Append dynamic allowed-value constraints so OCR output matches UI-selectable options
  const effectiveInvoiceType: "ELECTRICITY" | "GAS" =
    invoiceType === "GAS" ? "GAS" : "ELECTRICITY";

  const electricityTaxConfig = (config as any).electricityTaxConfig as
    | Record<string, any>
    | undefined;
  const electricityZoneOptions: string[] = [];
  if (electricityTaxConfig?.peninsula) electricityZoneOptions.push("Peninsula");
  if (electricityTaxConfig?.baleares) electricityZoneOptions.push("Baleares");
  if (electricityTaxConfig?.canarias) electricityZoneOptions.push("Canarias");
  const fallbackElectricityZones = ["Peninsula", "Baleares", "Canarias"];

  // In the current UI, gas has a single zone value "Peninsula"
  // (displayed as "Peninsula and Balearic Islands").
  const gasZoneOptions = ["Peninsula"];

  const allowedZones =
    effectiveInvoiceType === "GAS"
      ? gasZoneOptions
      : electricityZoneOptions.length > 0
        ? electricityZoneOptions
        : fallbackElectricityZones;

  const allowedTariffs =
    effectiveInvoiceType === "GAS"
      ? [
          "RL01",
          "RL02",
          "RL03",
          "RL04",
          "RL05",
          "RL06",
          "RLPS1",
          "RLPS2",
          "RLPS3",
          "RLPS4",
          "RLPS5",
          "RLPS6",
        ]
      : ["2.0TD", "3.0TD", "6.1TD"];

  // Extract available tax/rate options from config for display in OCR prompt.
  const toNumberArray = (value: unknown): number[] =>
    Array.isArray(value)
      ? value
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item))
      : [];

  const uniqueSorted = (values: number[]): number[] =>
    Array.from(new Set(values.filter((value) => Number.isFinite(value)))).sort(
      (a, b) => a - b,
    );

  const gasTaxConfig = (config as any).gasTaxConfig as
    | Record<string, any>
    | undefined;

  const electricityIvaOptions = uniqueSorted([
    ...toNumberArray((config as any).ivaRateOptions),
    Number((config as any).ivaRate),
    ...toNumberArray(electricityTaxConfig?.peninsula?.ivaOptions),
    ...toNumberArray(electricityTaxConfig?.peninsula?.ivaRates),
    ...toNumberArray(electricityTaxConfig?.baleares?.ivaOptions),
    ...toNumberArray(electricityTaxConfig?.baleares?.ivaRates),
    ...toNumberArray(electricityTaxConfig?.canarias?.igicOptions),
    ...toNumberArray(electricityTaxConfig?.canarias?.igicRates),
  ]);

  const electricityTaxRateOptions = uniqueSorted([
    ...toNumberArray((config as any).electricityTaxRateOptions),
    Number((config as any).electricityTaxRate),
    ...toNumberArray(electricityTaxConfig?.peninsula?.elecTaxOptions),
    ...toNumberArray(electricityTaxConfig?.peninsula?.elecTaxRates),
    ...toNumberArray(electricityTaxConfig?.baleares?.elecTaxOptions),
    ...toNumberArray(electricityTaxConfig?.baleares?.elecTaxRates),
    ...toNumberArray(electricityTaxConfig?.canarias?.elecTaxOptions),
    ...toNumberArray(electricityTaxConfig?.canarias?.elecTaxRates),
  ]);

  const gasIvaOptions = uniqueSorted([
    ...toNumberArray((config as any).ivaRateOptions),
    Number((config as any).ivaRate),
    ...toNumberArray(gasTaxConfig?.peninsula?.ivaOptions),
    ...toNumberArray(gasTaxConfig?.peninsula?.ivaRates),
    ...toNumberArray(gasTaxConfig?.baleares?.ivaOptions),
    ...toNumberArray(gasTaxConfig?.baleares?.ivaRates),
  ]);

  const hydrocarbonTaxRateOptions = uniqueSorted([
    ...toNumberArray((config as any).hydrocarbonTaxRateOptions),
    Number((config as any).hydrocarbonTaxRate),
    ...toNumberArray(gasTaxConfig?.hydrocarbonTaxOptions),
    ...toNumberArray(gasTaxConfig?.hydrocarbonTaxRates),
  ]);

  // Format options for display in prompt (convert to percentages)
  const formatTaxOptionsForPrompt = (options: number[]): string => {
    if (options.length === 0) return "not available";
    return options.map((opt) => `${(opt * 100).toFixed(5)}%`).join(", ");
  };

  const formatRateOptionsForPrompt = (options: number[]): string => {
    if (options.length === 0) return "not available";
    return options.map((opt) => opt.toFixed(5)).join(", ");
  };

  activePrompt += `

---
SYSTEM ALLOWED OPTIONS (MUST FOLLOW)
- zonaGeografica: return ONLY one of: ${allowedZones.join(", ")}
- tarifaAcceso: return ONLY one of: ${allowedTariffs.join(", ")}
${
  effectiveInvoiceType === "ELECTRICITY"
    ? `- ivaTasa (for Electricity): prefer one of ${formatTaxOptionsForPrompt(electricityIvaOptions)}, but if the invoice explicitly prints another IVA/IGIC rate, return the printed rate.
- impuestoElectricoTasa (Electricity Tax): prefer one of ${formatTaxOptionsForPrompt(
        electricityTaxRateOptions,
      )}, but if the invoice explicitly prints another electricity tax rate, return the printed rate. These are rates, NOT VAT totals.`
    : `- ivaTasa (for Gas): prefer one of ${formatTaxOptionsForPrompt(gasIvaOptions)}, but if the invoice explicitly prints another IVA/IGIC rate, return the printed rate.
- impuestoHidrocarburo (Hydrocarbon Tax €/kWh): return ONLY one of: ${formatRateOptionsForPrompt(
        hydrocarbonTaxRateOptions,
      )} (this is the unit rate, NOT the euro total/import amount)`
}
${
  effectiveInvoiceType === "GAS"
    ? `- For gas invoices, map "Peninsula and Balearic Islands" to zonaGeografica = "Peninsula".
- For gas invoices, when a row shows quantity, unit price, and importe, use the unit price for impuestoHidrocarburo. Example: "99.393 kWh 0,002340 232,58 Eur" => impuestoHidrocarburo = 0.00234.
- For gas invoices, if the invoice only shows "0,65 Eur/Gj" for hydrocarbon tax and the allowed €/kWh options include 0.00234, return 0.00234.`
    : ""
}
If invoice text uses a different format, map it to the closest allowed value above.
---`;

  debugOcrLog("File type:", file?.type);
  debugOcrLog("File size:", file?.size, "bytes");

  if (!file) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName,
      baseUrl: llmBaseUrl,
      persistedFiles: requestFiles,
      errorMessage: "No file provided",
      errorType: "VALIDATION_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message: "No file provided",
      },
      { status: 400 },
    );
  }

  if (invoiceCountParam !== null && invoiceCountParam > 1) {
    const normalizedInvoiceCount = Math.round(invoiceCountParam);
    const messageKey = "multipleInvoicesNotAllowed";
    const message = `Only 1 invoice can be uploaded at once. This file appears to contain ${normalizedInvoiceCount} invoices. Please upload a new file with a single invoice.`;
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName,
      baseUrl: llmBaseUrl,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      persistedFiles: requestFiles,
      errorMessage: message,
      errorType: "MULTIPLE_INVOICES_NOT_ALLOWED",
      httpStatusCode: 400,
      metadata: {
        invoiceCount: normalizedInvoiceCount,
      },
    });
    return NextResponse.json(
      {
        success: false,
        code: "MULTIPLE_INVOICES_NOT_ALLOWED",
        message: messageKey,
        messageKey,
        messageParams: { count: normalizedInvoiceCount },
        invoiceCount: normalizedInvoiceCount,
      },
      { status: 400 },
    );
  }

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    await saveOcrLog({
      status: "FAILED",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName,
      baseUrl: llmBaseUrl,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      persistedFiles: requestFiles,
      errorMessage: `Invalid file type: ${file.type}`,
      errorType: "VALIDATION_ERROR",
      httpStatusCode: 400,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Invalid file type. Please upload a PDF or image file.",
      },
      { status: 400 },
    );
  }

  let convertedPdfLogFiles: OcrPersistedFile[] = [];
  let uploadedLogFiles: OcrPersistedFile[] = [];

  try {
    const buffer = file.fileData;
    recordPhase("fileArrayBufferMs", Date.now(), undefined);
    uploadedLogFiles = [
      {
        fileName: file.name,
        fileType: file.type || null,
        fileSizeBytes: file.size,
        fileData: buffer,
      },
    ];
    const base64StartedAt = Date.now();
    const base64File = buffer.toString("base64");
    recordPhase("fileBase64Ms", base64StartedAt, undefined);

    // ── PDF text extraction (font-rendering fallback) ─────────────────────
    // Some PDFs use non-embedded fonts (e.g. Arial, Courier New) that are not
    // available on Vercel's Linux environment. When pdfjs tries to render these
    // to images the text layer comes out blank, causing the LLM to return only
    // the invoice type. To guard against this we always extract the raw text
    // layer from the PDF via pdfjs (same lib used for image conversion) and
    // append it to the prompt so the LLM can fall back to the text even when
    // the rendered images are unreadable.
    if (file.type === "application/pdf") {
      try {
        const rawText = await timed("pdfTextExtractionMs", async () => {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          await configurePdfJsWorker(pdfjsLib);

          const loadingTask = (pdfjsLib as any).getDocument({
            data: new Uint8Array(buffer),
            verbosity: 0,
          });
          const pdf = await loadingTask.promise;
          const textParts: string[] = [];

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str ?? "")
              .join(" ")
              .replace(/\s{3,}/g, "  ")
              .trim();
            if (pageText) textParts.push(pageText);
          }

          return textParts.join("\n\n").trim();
        });
        if (rawText && rawText.length > 50) {
          activePrompt =
            activePrompt +
            `\n\n---\nEXTRACTED PDF TEXT (use this if the images are unreadable):\n${rawText}\n---`;
          debugOcrLog(
            `[PDF text extraction] Appended ${rawText.length} chars of raw text to prompt`,
          );
        }
      } catch (textErr) {
        // Non-fatal – proceed without the text layer
        console.warn("[PDF text extraction] Failed to extract text:", textErr);
      }

      try {
        const openDataLoaderExtraction = await timed("openDataLoaderMs", () =>
          extractPdfWithOpenDataLoader(buffer, file.name, OCR_MAX_PDF_PAGES),
        );

        if (openDataLoaderExtraction?.skippedReason) {
          debugOcrLog(
            `[OpenDataLoader PDF extraction] Skipped: ${openDataLoaderExtraction.skippedReason}`,
          );
        } else if (openDataLoaderExtraction?.content) {
          activePrompt =
            activePrompt +
            `\n\n---\nSTRUCTURED PDF EXTRACTION (OpenDataLoader helper):\nUse this parser output as supporting evidence for text, tables, periods, totals, and reading order. If it conflicts with the visible invoice/PDF evidence, prefer the visible invoice/PDF evidence.\n\n${openDataLoaderExtraction.content}\n---`;
          debugOcrLog(
            `[OpenDataLoader PDF extraction] Appended ${openDataLoaderExtraction.content.length} chars to prompt` +
              (openDataLoaderExtraction.truncated
                ? ` (truncated from ${openDataLoaderExtraction.originalLength})`
                : ""),
          );
        }
      } catch (openDataLoaderErr) {
        // Non-fatal – OpenDataLoader depends on Java and may be unavailable in
        // some deploy targets. Keep the existing OCR flow working.
        console.warn(
          "[OpenDataLoader PDF extraction] Failed to extract structured PDF text:",
          openDataLoaderErr,
        );
      }
    }

    // Handle PDF conversion for Ollama providers
    let imagesToProcess: Array<{ base64: string; mimeType: string }> = [];

    if (file.type === "application/pdf") {
      // Providers that need image input receive rendered invoice pages.
      if (
        llmProvider === "ollama" ||
        isOpenAiCompatibleProvider(llmProvider) ||
        isBedrockMantleProvider(llmProvider) ||
        isAnthropicBedrockRuntime(llmProvider, llmBaseUrl) ||
        isNvidiaBedrockRuntime(llmProvider)
      ) {
        const pdfImages = await timed("pdfRenderMs", () =>
          convertPdfToImages(buffer, OCR_MAX_PDF_PAGES, OCR_PDF_RENDER_SCALE),
        );
        const fileNameWithoutExt = file.name.replace(/\.[^.]+$/, "");

        convertedPdfLogFiles = pdfImages.map((img) => {
          const imageBuffer = Buffer.from(img.base64, "base64");
          return {
            fileName: `${fileNameWithoutExt}_page_${img.pageNumber}.${img.fileExtension}`,
            fileType: img.mimeType,
            fileSizeBytes: imageBuffer.length,
            fileData: imageBuffer,
          };
        });

        imagesToProcess = pdfImages.map((img) => ({
          base64: img.base64,
          mimeType: img.mimeType,
        }));
      }
      // For other providers (OpenAI, Anthropic, Google), they handle PDFs natively
      // So we don't need to convert, just use the original base64File
    } else {
      // For images, prepare for processing
      imagesToProcess = [
        {
          base64: base64File,
          mimeType: file.type,
        },
      ];
    }

    if (
      (isAnthropicBedrockRuntime(llmProvider, llmBaseUrl) ||
        isBedrockMantleProvider(llmProvider) ||
        isNvidiaBedrockRuntime(llmProvider)) &&
      imagesToProcess.length > 1
    ) {
      if (imagesToProcess.length > OCR_BEDROCK_MULTI_IMAGE_MAX_COUNT) {
        console.warn(
          `[OCR] Limiting Bedrock image count from ${imagesToProcess.length} to ${OCR_BEDROCK_MULTI_IMAGE_MAX_COUNT}`,
        );
        imagesToProcess = imagesToProcess.slice(
          0,
          OCR_BEDROCK_MULTI_IMAGE_MAX_COUNT,
        );
      }

      const constrainedImages: Array<{ base64: string; mimeType: string }> = [];
      for (const image of imagesToProcess) {
        constrainedImages.push(await constrainImageForBedrock(image));
      }
      imagesToProcess = constrainedImages;
    }

    // Prepare LLM request based on provider
    let llmResponse: Response;

    if (llmProvider === "ollama") {
      // Local Ollama doesn't support vision API
      await saveOcrLog({
        status: "FAILED",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        persistedFiles: [...uploadedLogFiles, ...convertedPdfLogFiles],
        errorMessage: "Invoice extraction with local Ollama is not supported.",
        errorType: "UNSUPPORTED_PROVIDER",
        httpStatusCode: 400,
      });
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice extraction with local Ollama is not supported. Please use Ollama Cloud, OpenAI, Anthropic, or Google AI.",
        },
        { status: 400 },
      );
    } else if (llmProvider === "ollama-cloud") {
      // Ollama Cloud with OpenAI-compatible format and vision models (qwen3-vl:235b)

      // Check if model supports vision
      const isVisionModel =
        llmModelName.includes("-vl") || llmModelName.includes("vision");
      if (!isVisionModel) {
        console.warn(
          `⚠️  Model "${llmModelName}" may not support vision/images`,
        );
        console.warn(
          `   Recommended vision models: qwen3-vl:235b, qwen3-vl:235b-instruct`,
        );
      }

      // Build content with all images (PDFs are converted to images)
      const content: any[] = [{ type: "text", text: activePrompt }];

      debugOcrLog(
        `Processing ${imagesToProcess.length} image(s) for Ollama Cloud`,
      );

      for (const img of imagesToProcess) {
        const imageDataUrl = `data:${img.mimeType};base64,${img.base64}`;
        debugOcrLog(
          `Adding image: ${img.mimeType}, base64 length: ${img.base64.length} chars`,
        );
        debugOcrLog(
          `Image data URL preview: ${imageDataUrl.substring(0, 100)}...`,
        );

        content.push({
          type: "image_url",
          image_url: {
            url: imageDataUrl,
          },
        });
      }

      const messages: any[] = [
        {
          role: "user",
          content,
        },
      ];

      debugOcrLog(
        "Request payload structure:",
        JSON.stringify(
          {
            model: llmModelName,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content.map((c: any) => ({
                type: c.type,
                ...(c.type === "image_url"
                  ? { image_url: "(base64 data)" }
                  : { text: "(prompt text)" }),
              })),
            })),
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          },
          null,
          2,
        ),
      );

      llmResponse = await timed("llmFetchMs", () =>
        fetch(`${llmBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
          },
          body: JSON.stringify({
            model: llmModelName,
            messages,
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          }),
          signal: AbortSignal.timeout(300000), // 300 second timeout for large vision models (e.g. qwen3-vl:235b)
        }),
      );
    } else if (isOpenAiCompatibleProvider(llmProvider)) {
      // OpenAI Vision API supports both images and PDFs
      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "text", text: activePrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${base64File}`,
              },
            },
          ],
        },
      ];

      llmResponse = await timed("llmFetchMs", () =>
        fetch(`${llmBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
          },
          body: JSON.stringify({
            model: llmModelName,
            messages,
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        }),
      );
    } else if (isBedrockMantleProvider(llmProvider)) {
      const content: any[] = [{ type: "text", text: activePrompt }];
      const bedrockImages =
        imagesToProcess.length > 0
          ? imagesToProcess
          : [{ base64: base64File, mimeType: file.type }];

      for (const img of bedrockImages) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
          },
        });
      }

      const bedrockBaseUrl = getBedrockRuntimeBaseUrl(llmBaseUrl);
      llmResponse = await timed("llmFetchMs", () =>
        fetch(
          `${bedrockBaseUrl}/model/${encodeURIComponent(llmModelName)}/invoke`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
            },
            body: JSON.stringify({
              messages: [{ role: "user", content }],
              temperature: llmTemperature,
              max_tokens: llmMaxTokens,
            }),
            signal: AbortSignal.timeout(300000),
          },
        ),
      );
    } else if (isAnthropicBedrockRuntime(llmProvider, llmBaseUrl)) {
      const content: any[] = [{ type: "text", text: activePrompt }];
      const bedrockImages =
        imagesToProcess.length > 0
          ? imagesToProcess
          : [{ base64: base64File, mimeType: file.type }];

      for (const img of bedrockImages) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimeType,
            data: img.base64,
          },
        });
      }

      const bedrockBaseUrl = llmBaseUrl.replace(/\/+$/, "");
      llmResponse = await timed("llmFetchMs", () =>
        fetch(
          `${bedrockBaseUrl}/model/${encodeURIComponent(llmModelName)}/invoke`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
            },
            body: JSON.stringify({
              anthropic_version: "bedrock-2023-05-31",
              max_tokens: llmMaxTokens,
              temperature: llmTemperature,
              messages: [
                {
                  role: "user",
                  content,
                },
              ],
            }),
            signal: AbortSignal.timeout(300000),
          },
        ),
      );
    } else if (isNvidiaBedrockRuntime(llmProvider)) {
      const content: any[] = [{ text: activePrompt }];
      const bedrockImages =
        imagesToProcess.length > 0
          ? imagesToProcess
          : [{ base64: base64File, mimeType: file.type }];

      for (const img of bedrockImages) {
        content.push({
          image: {
            format: getBedrockImageFormat(img.mimeType),
            source: { bytes: img.base64 },
          },
        });
      }

      const bedrockBaseUrl = llmBaseUrl.replace(/\/+$/, "");
      llmResponse = await timed("llmFetchMs", () =>
        fetch(
          `${bedrockBaseUrl}/model/${encodeURIComponent(llmModelName)}/converse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {}),
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "user",
                  content,
                },
              ],
              inferenceConfig: {
                maxTokens: llmMaxTokens,
                temperature: llmTemperature,
              },
            }),
            signal: AbortSignal.timeout(300000),
          },
        ),
      );
    } else if (
      llmProvider === "anthropic" ||
      llmProvider === "aws-bedrock-anthropic"
    ) {
      // Anthropic Claude Vision API supports PDFs and images
      llmResponse = await timed("llmFetchMs", () =>
        fetch(`${llmBaseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": llmApiKey || "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: llmModelName,
            max_tokens: llmMaxTokens,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: activePrompt },
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: file.type,
                      data: base64File,
                    },
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(30000),
        }),
      );
    } else if (llmProvider === "google") {
      // Google Gemini Vision API supports PDFs and images
      llmResponse = await timed("llmFetchMs", () =>
        fetch(
          `${llmBaseUrl}/models/${llmModelName}:generateContent?key=${llmApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: activePrompt },
                    {
                      inline_data: {
                        mime_type: file.type,
                        data: base64File,
                      },
                    },
                  ],
                },
              ],
            }),
            signal: AbortSignal.timeout(30000),
          },
        ),
      );
    } else {
      await saveOcrLog({
        status: "FAILED",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        persistedFiles: [...uploadedLogFiles, ...convertedPdfLogFiles],
        errorMessage: `Provider ${llmProvider} is not supported for invoice extraction`,
        errorType: "UNSUPPORTED_PROVIDER",
        httpStatusCode: 400,
      });
      return NextResponse.json(
        {
          success: false,
          message: `Provider ${llmProvider} is not supported for invoice extraction`,
        },
        { status: 400 },
      );
    }

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      const providerError = errorText?.trim();
      const compactProviderError = providerError
        ? providerError.replace(/\s+/g, " ").slice(0, 1000)
        : null;
      console.error("LLM API error", {
        status: llmResponse.status,
        provider: llmProvider,
        model: llmModelName,
        providerError: compactProviderError,
      });
      await saveOcrLog({
        status: "ERROR",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        persistedFiles: [...uploadedLogFiles, ...convertedPdfLogFiles],
        errorMessage: `LLM API error: ${llmResponse.status} ${llmResponse.statusText}${compactProviderError ? ` - ${compactProviderError}` : ""}`,
        errorType: "LLM_API_ERROR",
        httpStatusCode: llmResponse.status,
        rawResponseSnippet: ocrDebugSnippet(errorText),
      });
      return NextResponse.json(
        {
          success: false,
          message: `LLM API error: ${llmResponse.status}${compactProviderError ? ` ${compactProviderError}` : ` ${llmResponse.statusText}`}`,
          provider: llmProvider,
          model: llmModelName,
        },
        { status: 500 },
      );
    }

    const llmData = await timed("llmResponseJsonMs", () => llmResponse.json());

    // Extract the response text based on provider
    let extractedText = "";
    if (
      isOpenAiCompatibleProvider(llmProvider) ||
      isBedrockMantleProvider(llmProvider)
    ) {
      const msg = llmData.choices?.[0]?.message;
      // qwen3 thinking models put the answer in `reasoning` when `content` is empty
      extractedText = msg?.content || msg?.reasoning || "";
    } else if (
      llmProvider === "anthropic" ||
      llmProvider === "aws-bedrock-anthropic"
    ) {
      extractedText = llmData.content?.[0]?.text || "";
    } else if (isNvidiaBedrockRuntime(llmProvider)) {
      extractedText = llmData.output?.message?.content?.[0]?.text || "";
    } else if (llmProvider === "google") {
      extractedText = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // Parse JSON from response
    let extractedData: any = {};

    // Try to extract JSON from the response (handling markdown code blocks)
    const jsonMatch =
      extractedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
      extractedText.match(/(\{[\s\S]*\})/);

    if (jsonMatch) {
      try {
        extractedData = recordPhase(
          "extractedJsonParseMs",
          Date.now(),
          JSON.parse(jsonMatch[1]),
        );
      } catch (e) {
        console.error("Failed to parse extracted JSON:", e);
        const createdParseLog = await saveOcrLog({
          status: "PARSE_ERROR",
          durationMs: Date.now() - requestStartTime,
          provider: llmProvider,
          model: llmModelName,
          baseUrl: llmBaseUrl,
          fileName: file.name,
          fileType: file.type,
          fileSizeBytes: file.size,
          persistedFiles: [...uploadedLogFiles, ...convertedPdfLogFiles],
          errorMessage: "Failed to parse extracted data from LLM response",
          errorType: "JSON_PARSE_ERROR",
          httpStatusCode: 500,
          rawResponseSnippet: ocrDebugSnippet(extractedText, 1000),
          metadata: { usage: llmData.usage ?? llmData.usageMetadata },
        });
        return NextResponse.json(
          {
            success: false,
            message: "Failed to parse extracted data from LLM response",
            ...(OCR_DEBUG_LOGS ? { debug: extractedText } : {}),
            ocrLogId: createdParseLog?.id ?? null,
          },
          { status: 500 },
        );
      }
    } else {
      const createdParseLog = await saveOcrLog({
        status: "PARSE_ERROR",
        durationMs: Date.now() - requestStartTime,
        provider: llmProvider,
        model: llmModelName,
        baseUrl: llmBaseUrl,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        persistedFiles: [...uploadedLogFiles, ...convertedPdfLogFiles],
        errorMessage: "No valid JSON data found in LLM response",
        errorType: "NO_JSON_FOUND",
        httpStatusCode: 500,
        rawResponseSnippet: ocrDebugSnippet(extractedText, 1000),
        metadata: { usage: llmData.usage ?? llmData.usageMetadata },
      });
      return NextResponse.json(
        {
          success: false,
          message: "No valid JSON data found in LLM response",
          ...(OCR_DEBUG_LOGS ? { debug: extractedText } : {}),
          ocrLogId: createdParseLog?.id ?? null,
        },
        { status: 500 },
      );
    }

    // ── Post-processing: sanitize and validate extracted fields ──────────────

    // Fix European thousand-separator misparse: Spanish invoices use "." as a thousand separator
    // (e.g. "7.181 kWh" = 7,181 kWh). The LLM sometimes returns these as floats (7.181) instead
    // of integers (7181). We detect this by checking if the sum of period values × 1000 ≈ consumoAnual.
    {
      const consumoPeriods = [
        "consumoP1",
        "consumoP2",
        "consumoP3",
        "consumoP4",
        "consumoP5",
        "consumoP6",
      ] as const;
      const periodValues = consumoPeriods
        .map((k) => extractedData[k])
        .filter((v): v is number => typeof v === "number");
      if (
        periodValues.length > 0 &&
        typeof extractedData.consumoAnual === "number" &&
        extractedData.consumoAnual > 100
      ) {
        const sumRaw = periodValues.reduce((a, b) => a + b, 0);
        const sumScaled = sumRaw * 1000;
        const annual = extractedData.consumoAnual;
        // If scaled sum is within 5% of annual, the LLM misread thousands separators as decimals
        if (Math.abs(sumScaled - annual) / annual < 0.05) {
          debugOcrLog(
            `[OCR Fix] Detected European thousand-separator misparse. Scaling consumo values ×1000 (sum=${sumRaw} → ${sumScaled}, consumoAnual=${annual})`,
          );
          for (const k of consumoPeriods) {
            if (typeof extractedData[k] === "number") {
              extractedData[k] = Math.round(extractedData[k] * 1000);
            }
          }
        }
      }
    }

    if (effectiveInvoiceType === "GAS") {
      delete extractedData.consumoAnual;
    }

    // CUPS validation: Spanish CUPS format is ES + exactly 16 digits + 2 uppercase letters.
    // Anything after the 2 trailing letters is cropped.
    // Strip spaces first, then extract.
    if (extractedData.cups) {
      const rawCups = String(extractedData.cups)
        .replace(/\s+/g, "")
        .toUpperCase();
      // Extract: ES + exactly 16 digits + 2 uppercase letters, anywhere in the string, crop the rest
      const cupsPattern = /ES\d{16}[A-Z]{2}/;
      const match = cupsPattern.exec(rawCups);
      if (match) {
        extractedData.cups = match[0];
      } else {
        console.warn(
          `⚠️  Discarding invalid CUPS value: "${rawCups}" (failed ES+16digits+2letters pattern — likely a barcode or reference code)`,
        );
        delete extractedData.cups;
      }
    }

    // CIF sanity check: reject obviously fake/example values
    if (extractedData.cif) {
      const knownPlaceholders = ["X-XXXXXXXX", "B12345678", "B00000000"];
      const cifUpper = String(extractedData.cif)
        .toUpperCase()
        .replace(/\s+/g, "");
      // Spanish CIF/NIF: letter + 7 digits + letter/digit, or 8 digits + letter (NIE)
      const validCifPattern =
        /^[A-Z]\d{7}[A-Z0-9]$|^\d{8}[A-Z]$|^[XYZ]\d{7}[A-Z]$/;
      if (
        knownPlaceholders.includes(extractedData.cif) ||
        !validCifPattern.test(cifUpper)
      ) {
        console.warn(
          `⚠️  Discarding invalid/placeholder CIF: "${extractedData.cif}"`,
        );
        delete extractedData.cif;
      } else {
        extractedData.cif = cifUpper;
      }
    }

    // ── TAX RATE VALIDATION: Match OCR values to configured options with rounding tolerance ──
    // Helper function to match an OCR value to available configured options
    const matchTaxRateToOption = (
      ocrValue: number | null | undefined,
      availableOptions: number[],
      fieldName: string,
    ): number | null => {
      if (
        ocrValue === null ||
        ocrValue === undefined ||
        availableOptions.length === 0
      ) {
        return null;
      }

      const numericValue = Number(ocrValue);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        return null;
      }

      // OCR may return rates as percentage points (21, 5.11269, 0.5) or
      // decimals (0.21, 0.0511269, 0.005). Try both interpretations when the
      // value is ambiguous so "0.5%" does not become 50%.
      const candidateValues = Array.from(
        new Set(
          numericValue > 1
            ? [numericValue / 100]
            : [numericValue, numericValue / 100],
        ),
      ).filter((value) => Number.isFinite(value));

      // Try to find an exact match in configured options
      const exactMatch = availableOptions.find((opt) =>
        candidateValues.some(
          (candidate) => Math.abs(opt - candidate) < 0.000001,
        ),
      );
      if (exactMatch !== undefined) {
        debugOcrLog(
          `[Tax Validation] Field "${fieldName}": OCR value ${ocrValue} matches configured option ${(exactMatch * 100).toFixed(5)}% exactly`,
        );
        return exactMatch;
      }

      // If no exact match, find the closest match within tolerance
      // Tolerance: allow up to 0.005 (0.5%) difference for rounding
      const toleranceThreshold = 0.005;
      let closestMatch: number | undefined;
      let closestDistance = Infinity;
      let closestCandidate = candidateValues[0] ?? numericValue;

      for (const candidate of candidateValues) {
        for (const option of availableOptions) {
          const distance = Math.abs(option - candidate);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestMatch = option;
            closestCandidate = candidate;
          }
        }
      }

      if (closestMatch !== undefined && closestDistance <= toleranceThreshold) {
        debugOcrLog(
          `[Tax Validation] Field "${fieldName}": OCR value ${ocrValue} (${(closestCandidate * 100).toFixed(5)}%) corrected to closest configured option ${(closestMatch * 100).toFixed(5)}% (distance: ${(closestDistance * 100).toFixed(5)}%)`,
        );
        return closestMatch;
      }

      // No match found within tolerance. Keep the explicit invoice value instead
      // of silently falling back to the configured default; some invoices print
      // temporarily reduced tax rates such as 0.5%.
      const normalizedValue =
        fieldName.includes("impuestoElectrico") &&
        numericValue > 0.2 &&
        numericValue <= 1
          ? numericValue / 100
          : numericValue > 1
            ? numericValue / 100
            : numericValue;
      console.warn(
        `⚠️  [Tax Validation] Field "${fieldName}": OCR value ${ocrValue} (${(normalizedValue * 100).toFixed(5)}%) does NOT match any configured option. Available options: ${availableOptions.map((opt) => `${(opt * 100).toFixed(5)}%`).join(", ")}. Keeping explicit invoice value.`,
      );
      return normalizedValue;
    };

    const matchUnitRateToOption = (
      ocrValue: number | null | undefined,
      availableOptions: number[],
      fieldName: string,
    ): number | null => {
      if (
        ocrValue === null ||
        ocrValue === undefined ||
        availableOptions.length === 0
      ) {
        return null;
      }

      const numericValue = Number(ocrValue);
      if (!Number.isFinite(numericValue)) {
        return null;
      }

      const exactMatch = availableOptions.find(
        (opt) => Math.abs(opt - numericValue) < 0.000001,
      );
      if (exactMatch !== undefined) {
        debugOcrLog(
          `[Tax Validation] Field "${fieldName}": OCR value ${ocrValue} matches configured unit rate ${exactMatch.toFixed(5)} exactly`,
        );
        return exactMatch;
      }

      // Hydrocarbon tax rates are tiny €/kWh values, so keep a narrow tolerance
      // to avoid accepting invoice line totals such as 232.58 as configured rates.
      const toleranceThreshold = 0.00005;
      let closestMatch: number | undefined;
      let closestDistance = Infinity;

      for (const option of availableOptions) {
        const distance = Math.abs(option - numericValue);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestMatch = option;
        }
      }

      if (closestMatch !== undefined && closestDistance <= toleranceThreshold) {
        debugOcrLog(
          `[Tax Validation] Field "${fieldName}": OCR value ${ocrValue} corrected to closest configured unit rate ${closestMatch.toFixed(5)} (distance: ${closestDistance.toFixed(5)})`,
        );
        return closestMatch;
      }

      console.warn(
        `⚠️  [Tax Validation] Field "${fieldName}": OCR value ${ocrValue} does NOT match any configured unit-rate option. Available options: ${availableOptions.map((opt) => opt.toFixed(5)).join(", ")}. Discarding value.`,
      );
      return null;
    };

    // Validate electricity tax rates (if electricity invoice)
    if (effectiveInvoiceType === "ELECTRICITY") {
      // Validate and correct impuestoElectricoTasa
      if (
        extractedData.impuestoElectricoTasa !== null &&
        extractedData.impuestoElectricoTasa !== undefined
      ) {
        const matched = matchTaxRateToOption(
          extractedData.impuestoElectricoTasa,
          electricityTaxRateOptions,
          "impuestoElectricoTasa",
        );
        if (matched !== null) {
          // Convert back to percentage format (as the rest of the system expects)
          extractedData.impuestoElectricoTasa = matched * 100;
        } else {
          delete extractedData.impuestoElectricoTasa;
        }
      }

      // Validate and correct ivaTasa
      if (
        extractedData.ivaTasa !== null &&
        extractedData.ivaTasa !== undefined
      ) {
        const matched = matchTaxRateToOption(
          extractedData.ivaTasa,
          electricityIvaOptions,
          "ivaTasa (Electricity)",
        );
        if (matched !== null) {
          // Convert back to percentage format
          extractedData.ivaTasa = matched * 100;
        } else {
          delete extractedData.ivaTasa;
        }
      }
    }

    // Validate gas tax rates (if gas invoice)
    if (effectiveInvoiceType === "GAS") {
      // Validate and correct ivaTasa
      if (
        extractedData.ivaTasa !== null &&
        extractedData.ivaTasa !== undefined
      ) {
        const matched = matchTaxRateToOption(
          extractedData.ivaTasa,
          gasIvaOptions,
          "ivaTasa (Gas)",
        );
        if (matched !== null) {
          // Convert back to percentage format
          extractedData.ivaTasa = matched * 100;
        } else {
          delete extractedData.ivaTasa;
        }
      }

      // Validate and correct impuestoHidrocarburo as a unit rate (€/kWh).
      if (
        extractedData.impuestoHidrocarburo !== null &&
        extractedData.impuestoHidrocarburo !== undefined
      ) {
        const matched = matchUnitRateToOption(
          extractedData.impuestoHidrocarburo,
          hydrocarbonTaxRateOptions,
          "impuestoHidrocarburo",
        );
        if (matched !== null) {
          extractedData.impuestoHidrocarburo = matched;
        } else {
          delete extractedData.impuestoHidrocarburo;
        }
      }
    }

    // Extract token usage from provider response
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;
    if (
      isOpenAiCompatibleProvider(llmProvider) ||
      isBedrockMantleProvider(llmProvider)
    ) {
      promptTokens = llmData.usage?.prompt_tokens;
      completionTokens = llmData.usage?.completion_tokens;
      totalTokens = llmData.usage?.total_tokens;
    } else if (
      llmProvider === "anthropic" ||
      llmProvider === "aws-bedrock-anthropic"
    ) {
      promptTokens = llmData.usage?.input_tokens;
      completionTokens = llmData.usage?.output_tokens;
      totalTokens =
        (llmData.usage?.input_tokens ?? 0) +
        (llmData.usage?.output_tokens ?? 0);
    } else if (isNvidiaBedrockRuntime(llmProvider)) {
      promptTokens = llmData.usage?.inputTokens;
      completionTokens = llmData.usage?.outputTokens;
      totalTokens = llmData.usage?.totalTokens;
    } else if (llmProvider === "google") {
      promptTokens = llmData.usageMetadata?.promptTokenCount;
      completionTokens = llmData.usageMetadata?.candidatesTokenCount;
      totalTokens = llmData.usageMetadata?.totalTokenCount;
    }

    const fieldsExtracted = Object.values(extractedData).filter(
      (v) => v !== null && v !== undefined && v !== "",
    ).length;

    const createdLog = await saveOcrLog({
      status: "SUCCESS",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider,
      model: llmModelName,
      baseUrl: llmBaseUrl,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      persistedFiles: [...uploadedLogFiles, ...convertedPdfLogFiles],
      deferFiles: true,
      deferDebugFields: true,
      pageCount:
        imagesToProcess.length > 0 ? imagesToProcess.length : undefined,
      promptTokens,
      completionTokens,
      totalTokens,
      extractedFields: extractedData,
      fieldsExtracted,
      httpStatusCode: 200,
      rawResponseSnippet: ocrDebugSnippet(extractedText, 1000),
      promptText: activePrompt,
      metadata: {
        temperature: llmTemperature,
        maxTokens: llmMaxTokens,
        imagesProcessed: imagesToProcess.length,
        invoiceProviderId: providerId ?? null,
        invoiceProviderName: invoiceProviderName ?? null,
        invoiceType: effectiveInvoiceType,
      },
    });
    phaseTimings.responseReadyMs = Date.now() - requestStartTime;
    perfOcrLog("[Invoice extraction timing] success", {
      ocrLogId: createdLog?.id ?? null,
      totalMs: phaseTimings.responseReadyMs,
      timings: phaseTimings,
      deferredFileCount: uploadedLogFiles.length + convertedPdfLogFiles.length,
    });

    return NextResponse.json({
      success: true,
      message: "Invoice data extracted successfully",
      data: extractedData,
      ocrLogId: createdLog?.id ?? null,
    });
  } catch (error: any) {
    console.error("Invoice extraction error", {
      errorType: error.constructor?.name,
      provider: llmProvider,
      model: llmModelName,
    });
    const createdErrorLog = await saveOcrLog({
      status: "ERROR",
      durationMs: Date.now() - requestStartTime,
      provider: llmProvider ?? "unknown",
      model: llmModelName ?? "unknown",
      baseUrl: llmBaseUrl,
      persistedFiles: [...uploadedLogFiles, ...convertedPdfLogFiles],
      errorMessage: error.message || "Unknown error",
      errorType: error.constructor?.name || "UnknownError",
      httpStatusCode: 500,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Failed to extract invoice data",
        errorType: error.constructor.name,
        provider: llmProvider,
        model: llmModelName,
        ocrLogId: createdErrorLog?.id ?? null,
      },
      { status: 500 },
    );
  } finally {
    cleanupTemporaryBlobs();
  }
});
