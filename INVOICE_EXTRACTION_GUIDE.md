# Invoice Data Extraction - Implementation Guide

## Overview

The AXPO Simulator now includes AI-powered invoice data extraction functionality that automatically reads Spanish energy invoices (PDF or images) and extracts relevant simulation data using LLM vision models.

## Features

- **Automatic Data Extraction**: Upload energy invoices and extract CUPS, tariff, consumption periods, power contracts, and billing information
- **Multi-Provider Support**: Works with OpenAI GPT-4V, Anthropic Claude 3, Google Gemini Pro Vision
- **Smart Client Matching**: Automatically matches or creates clients based on invoice holder name
- **Tariff Detection**: Auto-detects commodity type (Electricity/Gas) from tariff information
- **Multilingual**: Full English and Spanish UI support

## Architecture

### Components

1. **InvoiceExtractor.tsx** (`/app/internal/components/modules/InvoiceExtractor.tsx`)
   - File upload UI component
   - Extraction status display
   - Callback interface for extracted data
   - File validation (format, size limits)

2. **Invoice Extraction API** (`/app/api/v1/internal/invoices/extract/route.ts`)
   - Multipart form-data handling
   - Base64 file encoding
   - LLM provider integration (OpenAI, Anthropic, Google)
   - Comprehensive extraction prompt
   - JSON response parsing

3. **New Simulation Page Integration** (`/app/internal/simulations/new/page.tsx`)
   - Invoice extractor component integration
   - Auto-population of simulation form
   - Client auto-matching/creation
   - Commodity type detection

### Data Flow

```
┌─────────────────┐
│ User uploads    │
│ invoice file    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ InvoiceExtractor        │
│ - Validates file        │
│ - Shows preview         │
└────────┬────────────────┘
         │ POST /api/v1/internal/invoices/extract
         ▼
┌─────────────────────────┐
│ API Route               │
│ - Gets LLM config       │
│ - Encodes file base64   │
│ - Calls LLM vision API  │
│ - Parses JSON response  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ ExtractedInvoiceData    │
│ - 30+ structured fields │
│ - CUPS, tariff, etc.    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ New Simulation Page     │
│ - Auto-fills form       │
│ - Matches/creates client│
│ - Sets commodity type   │
└─────────────────────────┘
```

## Extracted Data Fields

The system extracts the following information from invoices:

### Client Information

- `nombreTitular`: Invoice holder name
- `cif`: Tax identification number (CIF/NIF)
- `direccion`: Client address
- `codigoPostal`: Postal code
- `poblacion`: City/town
- `provincia`: Province
- `contactoNombre`: Contact person name
- `contactoEmail`: Contact email
- `contactoTelefono`: Contact phone

### Supply Point Information

- `cups`: CUPS identifier (unique supply point code)
- `tarifaAcceso`: Access tariff (e.g., 2.0TD, 3.0TD, 6.1TD)
- `direccionSuministro`: Supply address
- `zonaGeografica`: Geographic zone

### Consumption Data (Electricity)

- `consumoP1` - `consumoP6`: Consumption by period (kWh)
- `potenciaP1` - `potenciaP6`: Contracted power by period (kW)

### Billing Period

- `fechaInicio`: Start date
- `fechaFin`: End date
- `diasFacturacion`: Number of days

### Financial Data

- `facturaActual`: Current invoice amount (€)
- `impuestosElectricidad`: Electricity tax
- `alquilerEquipos`: Equipment rental
- `reactiva`: Reactive energy charges
- `otrosCargos`: Other charges
- `totalPagar`: Total amount to pay

### Gas-Specific Data

- `consumoGas`: Gas consumption (kWh or m³)
- `precioGas`: Gas price
- `terminoFijo`: Fixed term

## LLM Configuration

Before using invoice extraction, configure LLM settings in the system configuration:

1. Navigate to **Internal → Configurations → LLM Settings**
2. Enable LLM features
3. Select a vision-capable provider:
   - **OpenAI**: GPT-4 Vision (recommended)
   - **Anthropic**: Claude 3 Opus/Sonnet
   - **Google**: Gemini Pro Vision
4. Enter API credentials
5. Test connection
6. Save configuration

### Recommended Models

| Provider  | Model                  | Pros                                  | Cons                         |
| --------- | ---------------------- | ------------------------------------- | ---------------------------- |
| OpenAI    | gpt-4-vision-preview   | Excellent accuracy, fast              | Higher cost                  |
| Anthropic | claude-3-opus-20240229 | Very accurate, good with complex docs | Slower                       |
| Google    | gemini-pro-vision      | Fast, cost-effective                  | Lower accuracy on poor scans |

**Note**: Ollama (local) does not support vision APIs directly and requires OCR preprocessing.

## Usage

### Basic Workflow

1. **Navigate to New Simulation**
   - Go to `/internal/simulations/new`

2. **Upload Invoice**
   - Click "Select Invoice File" in the Invoice Data Extraction section
   - Choose a PDF or image file (max 10MB)
   - Supported formats: PDF, JPG, PNG, WEBP

3. **Extract Data**
   - Click "Extract Data" button
   - Wait for LLM processing (5-15 seconds)
   - Review extracted data preview

4. **Complete Simulation**
   - Extracted data auto-populates form fields
   - Client is auto-matched or quick-create form is pre-filled
   - Commodity type is detected from tariff
   - Verify and submit simulation

### Example Invoices

Sample invoices are available in `/invoices_Examples/`:

- `Factura FGAS 2600024427.pdf` - Gas invoice
- `PI26142000000954.000332.FD.pdf` - Electricity invoice
- `POLYPRES MEDITERRANEO, S.L. 20260305.pdf` - Complex invoice
- `MARZO LHIERROS.pdf` - Monthly invoice
- `Faturas dos ultimos 12 meses.pdf` - Multi-period invoice

## Extraction Prompt

The system uses a comprehensive prompt that instructs the LLM to:

1. **Identify Invoice Type**: ELECTRICITY, GAS, or BOTH
2. **Extract Structured Data**: All 30+ fields in JSON format
3. **Handle Missing Data**: Return `null` for unavailable fields
4. **Parse Tariff Information**: Recognize Spanish tariff codes (2.0TD, 3.0TD, 6.1TD, etc.)
5. **Extract Period Consumption**: Identify P1-P6 consumption and power values
6. **Calculate Totals**: Extract all financial components

### Prompt Structure

```
You are an AI assistant specialized in extracting data from Spanish energy invoices.

TASK: Extract ALL available information from the provided invoice image/PDF.

INVOICE TYPES:
- ELECTRICITY: Electric supply invoice
- GAS: Gas supply invoice
- BOTH: Combined electricity and gas invoice

OUTPUT FORMAT: JSON object with these fields:
{
  "tipoFactura": "ELECTRICITY" | "GAS" | "BOTH",
  "nombreTitular": "string",
  "cups": "string",
  "tarifaAcceso": "string",
  ...
}

INSTRUCTIONS:
1. Carefully read ALL text in the invoice
2. Extract EVERY available field
3. Use null for missing/unavailable fields
4. Ensure accuracy for CUPS and tariff codes
5. Parse consumption by period (P1-P6)
6. Include all financial amounts
```

## Error Handling

### Common Errors

| Error                | Cause                  | Solution                   |
| -------------------- | ---------------------- | -------------------------- |
| "LLM not configured" | LLM settings not saved | Configure LLM in Settings  |
| "LLM not enabled"    | LLM features disabled  | Enable LLM in Settings     |
| "File too large"     | File > 10MB            | Compress or split file     |
| "Invalid format"     | Unsupported file type  | Use PDF, JPG, PNG, or WEBP |
| "Connection timeout" | LLM API timeout        | Check network, retry       |
| "Invalid response"   | LLM returned bad JSON  | Retry extraction           |

### Troubleshooting

**Extraction returns incomplete data:**

- Ensure invoice is clear and legible
- Try a higher resolution scan
- Use a more capable model (GPT-4V)
- Check if invoice is in Spanish

**Client not auto-matched:**

- Verify exact name match in client database
- Enable quick create in system settings
- Manually create client after extraction

**Wrong commodity type detected:**

- Manually change after extraction
- Check tariff code format in invoice
- Report issue for prompt improvement

## API Reference

### POST `/api/v1/internal/invoices/extract`

Extract data from uploaded invoice.

**Request:**

```http
POST /api/v1/internal/invoices/extract
Content-Type: multipart/form-data

file: <invoice.pdf>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tipoFactura": "ELECTRICITY",
    "nombreTitular": "POLYPRES MEDITERRANEO, S.L.",
    "cif": "B12345678",
    "cups": "ES0031405900001234567SD",
    "tarifaAcceso": "3.0TD",
    "consumoP1": 1234.5,
    "consumoP2": 987.3,
    "potenciaP1": 15.0,
    "potenciaP2": 15.0,
    "facturaActual": 345.67,
    "fechaInicio": "2024-03-01",
    "fechaFin": "2024-03-31",
    ...
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "LLM not configured"
}
```

## Translation Keys

All UI text is fully internationalized:

```typescript
invoiceExtractor: {
  title: "Invoice Data Extraction",
  description: "Upload an energy invoice to extract data",
  uploadPrompt: "Select Invoice File",
  uploadHint: "Supported formats: PDF, JPG, PNG, WEBP (max 10MB)",
  extracting: "Extracting data from invoice...",
  extract: "Extract Data",
  remove: "Remove File",
  success: "Invoice data extracted successfully",
  error: "Failed to extract invoice data",
  // ... Spanish translations available
}
```

## Future Enhancements

Potential improvements:

1. **OCR Preprocessing**: Add OCR for Ollama/local models
2. **Batch Processing**: Extract multiple invoices at once
3. **Historical Comparison**: Compare with previous invoices
4. **Auto-Validation**: Cross-check extracted data with known patterns
5. **Learning Mode**: Fine-tune prompts based on success rate
6. **Template Library**: Pre-defined extractors for known invoice formats
7. **Export/Import**: Save extracted data as JSON for reuse

## Security Considerations

- **API Keys**: Stored securely in database, never exposed to client
- **File Upload**: Limited to 10MB, validated file types
- **Data Privacy**: Invoice data is not stored, only extracted fields
- **Access Control**: Only authenticated internal users can extract
- **Rate Limiting**: Consider adding limits on extraction API calls

## Performance

Typical extraction times by provider:

| Provider  | Model                | Average Time | Cost per Extraction |
| --------- | -------------------- | ------------ | ------------------- |
| OpenAI    | gpt-4-vision-preview | 5-8s         | ~$0.01-0.02         |
| Anthropic | claude-3-opus        | 8-12s        | ~$0.02-0.03         |
| Google    | gemini-pro-vision    | 3-5s         | ~$0.005-0.01        |

_Times and costs are approximate and may vary based on invoice complexity and API load_

## Support

For issues or questions:

1. Check LLM configuration in Settings
2. Verify invoice format and quality
3. Test with sample invoices in `/invoices_Examples/`
4. Review API logs for detailed error messages
5. Contact system administrator

---

**Last Updated**: January 2024  
**Version**: 1.0.0
