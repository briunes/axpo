# AXPO Simulator Calculation Logic

## Overview

The Excel simulator takes user inputs (left side) and calculates results (right side) based on base values stored in the database. The calculations happen in the "." (dot) sheet.

## Data Flow

```
User Inputs (PETICION DATOS LUZ)
    ↓
Calculation Sheet (".")
    ↓
Base Values (BASE DE DATOS FIJO / BASE DE DATOS INDEX)
    ↓
Results (COMPARATIVA LUZ)
```

## Key Input Parameters

### Electricity Inputs

1. **Tariff** (`tarifaAcceso`): 2.0TD, 3.0TD, or 6.1TD
2. **Geographic Zone** (`zonaGeografica`): Peninsula, Baleares, Canarias
3. **Period** (`periodo`): Start date, end date, number of days
4. **Consumption** (`consumo`): kWh per period (P1-P6 depending on tariff)
5. **Contracted Power** (`potencia`): kW per period (P1-P6)
6. **Load Profile** (`perfilCarga`): NORMAL or DIURNO
7. **Current Invoice** (`facturaActual`): Total in €

### Gas Inputs

1. **Tariff** (`tarifaAcceso`): RL01-RL06, RLPS1-RLPS6
2. **Geographic Zone** (`zonaGeografica`): Peninsula, Baleares
3. **Consumption** (`consumo`): Total kWh
4. **Telemetry** (`telemedida`): SI/NO
5. **Period**: Start date, end date, days
6. **Current Invoice**: Total in €

## Base Values Structure

Base values are stored with this naming convention:

### Electricity Fixed Rates

```
ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:ENERGIA   → €/kWh
ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA  → €/kW/year
```

### Electricity Indexed Rates

```
ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:MARGEN   → €/kWh margin over OMIE
ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA → €/kW/year
```

### Gas Fixed Rates

```
GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:ENERGIA       → €/kWh
GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:TERMINO_DIA          → €/day
```

### Gas Indexed Rates

```
GAS:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:MARGEN       → €/kWh margin over MIBGAS
```

### Market References

```
MIBGAS:{YYYY}-{MM}  → €/kWh MIBGAS monthly average
OMIE:{YYYY}-{MM}    → €/MWh OMIE monthly average
```

## Calculation Formula (Electricity)

For each product/rate, the Excel calculates:

### 1. Energy Cost

```
energyCost = Σ(consumption[period] * energyPrice[period])
```

- For **FIXED rates**: `energyPrice` comes from `ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:ENERGIA`
- For **INDEXED rates**: `energyPrice = OMIE_price + margin` where margin comes from `ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:MARGEN`

### 2. Power Cost

```
powerCost = Σ(contractedPower[period] * powerPrice[period] * days) / normalizer
```

- `powerPrice` from `ELEC:FIJO/INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA`
- `normalizer` depends on the unit:
  - €/kW/year → divide by 365
  - €/kW/month → divide by (365/12)
  - €/kW/day → divide by 1

### 3. Excess Power Cost (for 3.0TD and 6.1TD)

The excess power charge is taken **directly from the client's current invoice as a € amount**.
This is a regulatory grid charge (IMP RDL) that is the same regardless of commercial supplier.
The Excel simulator (cell E35) simply passes it through unchanged — no recalculation is done.

```
excessCost = excesoPotencia  (direct € amount from client invoice)
```

> **Why?** The excess power penalty is set by the regulator and applied by the network operator.
> Changing commercial supplier does not affect this charge, so there is no formula to apply.

### 4. Other Charges

Two types of charges are treated differently for tax purposes:

- **`otrosCargos`** (IMP RDL / other regulatory charges): **included** in the Impuesto Eléctrico base
- **`alquilerEquipoMedida`** (meter rental): **excluded** from Impuesto Eléctrico base, only added before IVA
- **`reactiva`** (reactive power surcharge): included in the Impuesto Eléctrico base

### 5. Taxes

This matches the exact order used in the Excel formula sheet (rows 1295–1315):

```
# Step 1: Build the Impuesto Eléctrico taxable base
baseImponible = energyCost + powerCost + excessCost + reactiva + otrosCargos

# Step 2: Apply Impuesto Eléctrico (5.11269632%)
impuestoElectrico = baseImponible × 0.0511269632

# Step 3: Add meter rental (alquiler) to get the IVA base
baseIva = baseImponible + impuestoElectrico + alquilerEquipoMedida

# Step 4: Apply IVA (21%)
iva = baseIva × 0.21
totalFactura = baseIva × 1.21
```

> ⚠️ **Common mistake**: `alquilerEquipoMedida` must be added **after** the impuesto base,
> not inside it. `otrosCargos` must be **inside** the impuesto base. Getting this wrong
> causes incorrect Impuesto Eléctrico values on every quote.

### 6. Savings Calculation

```
ahorro€ = currentInvoice - totalFactura
ahorro% = ahorro€ / currentInvoice
ahorroAnual = ahorro€ * (365 / days)
```

## Product Tiers

- **N1** (Super): Highest quality/price tier
- **N2** (Estándar): Standard tier
- **N3** (Extra): Economy tier

## Products

### Fixed Electricity Products

- `ESTABLE`: Basic fixed rate
- `ESTABLE_PLUS`: Enhanced fixed rate
- `1P_PLUS`: Single-period fixed rate
- `1P_PLUS_XL`: Single-period XL fixed rate
- `ESTABLE_TALLERES`: Workshop fixed rate
- `ESTABLE_PLUS_TALLERES`: Workshop enhanced fixed rate

### Indexed Electricity Products

- `DINAMICA`: Basic indexed (OMIE-based)
- `DINAMICA_PLUS`: Enhanced indexed
- `DINAMICA_CONTROL`: Indexed with control
- `DINAMICA_CONTROL_PLUS`: Enhanced indexed with control
- `DINAMICA_CONTROL_TECHO`: Indexed with ceiling

### Gas Products

Similar structure for gas with its own product names.

## Period Mapping by Tariff

### 2.0TD

- Energy periods: P1, P2, P3
- Power periods: P1, P2

### 3.0TD & 6.1TD

- Energy periods: P1, P2, P3, P4, P5, P6
- Power periods: P1, P2, P3, P4, P5, P6
- Excess periods: P1, P2, P3

## Implementation Notes

1. The "." sheet in Excel performs all lookups using formulas like:

   ```excel
   ='BASE DE DATOS FIJO'!B8
   ```

2. Month is derived from the period dates to look up OMIE/MIBGAS values

3. Geographic zone affects which base values are used (Peninsula vs Baleares vs Canarias)

4. Load profile (NORMAL vs DIURNO) may affect OMIE price selection

5. All base values must be pre-loaded into the database from the Excel file using the parse-xlsm-prices.py script
