export function buildProviderDetectionPrompt(providerListText: string): string {
  return `You are analyzing a Spanish energy invoice image to identify the energy supplier/provider company.

KNOWN PROVIDERS LIST:
${providerListText}

TASK:
Look at the invoice and identify the energy company that issued this invoice (the supplier/provider, NOT the customer).

Look for:
- Company logo
- Company name in the header
- "Comercializadora" or "Suministradora" field
- Footer with company details

TASK 2 — COMMODITY TYPE:
Also determine whether this is an electricity or gas invoice.

Important:
- Do NOT classify as ELECTRICITY merely because the invoice contains "kWh" or "CUPS".
- Gas invoices may also use kWh and CUPS.
- Treat "kWh", "CUPS", "consumo", and generic "energía" as neutral unless accompanied by commodity-specific terms.

Strong GAS indicators:
- "gas", "factura gas", "facturagas", "gas natural"
- "hidrocarburos", "impuesto especial hidrocarburos"
- "poder calorífico", "coeficiente de conversión", "Gj", "PCS"
- "caudal", "peaje gas", "término variable gas"

Strong ELECTRICITY indicators:
- "electricidad", "energía eléctrica", "luz"
- "potencia contratada", "término de potencia"
- "peaje de acceso electricidad", "discriminación horaria"
- periods like P1/P2/P3 when tied to power or electricity energy charges
- "alquiler contador electricidad"

Decision rule:
- If strong GAS indicators appear and no strong ELECTRICITY indicators appear → GAS.
- If strong ELECTRICITY indicators appear and no strong GAS indicators appear → ELECTRICITY.
- If strong indicators for both appear → BOTH.
- If only neutral terms like "kWh", "CUPS", "consumo", or generic "energía" appear → null.
- If unclear → null.

TASK 3 — ENERGY SUPPLY INVOICE COUNT:
Determine how many separate electricity or gas SUPPLY invoices are present in the uploaded document/images. The value returned in invoiceCount must be this energy-supply invoice count, not the count of every document called an invoice.

Count each distinct electricity or gas supply invoice, including when invoices have the same provider, customer, supply point, or commodity. Multiple distinct supply invoice numbers, full supply-invoice headers, billing periods, or clearly separate supply-invoice sections are strong evidence of multiple supply invoices.

Do NOT count any of the following as an additional energy supply invoice:
- ancillary service invoices bundled with the supply invoice, such as maintenance, repairs, insurance, equipment, "factura de servicios", "OK Luz", "OK Gas", or similar add-on services;
- a summary or payment page that totals the energy invoice together with ancillary services;
- multiple pages, duplicates, annexes, or continuation pages belonging to the same supply invoice.

Important Endesa pattern: an Endesa document can contain one "factura de electricidad" or "factura de gas" plus a separate "factura de servicios" and a "resumen total de las facturas". This is ONE energy supply invoice, so return invoiceCount: 1. However, if the document contains two distinct electricity/gas supply invoices, return invoiceCount: 2 even if they are both from Endesa or for the same customer.

Use invoice numbers and document headings to distinguish supply invoices from service attachments. If unsure whether an additional section is a supply invoice or an ancillary service, do not count it as another supply invoice. If unsure overall, return 1.

RESPONSE FORMAT:
Respond with ONLY a JSON object, no markdown, no explanation:
{
  "providerName": "exact company name as printed on invoice",
  "matchedSlug": "slug from the known providers list if it matches, or null if not in the list",
  "confidence": "high" or "low",
  "invoiceType": "ELECTRICITY" or "GAS" or "BOTH" or null,
  "invoiceCount": 1
}

If the provider is in the known list, set matchedSlug to its slug.
If not in the list, set matchedSlug to null and still return the providerName you found.
If you cannot determine the provider at all, return providerName as null.`;
}
