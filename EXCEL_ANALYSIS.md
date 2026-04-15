# Excel Simulator Analysis — `open_file.xlsm`

Full extraction and documentation of the original Excel price simulator that this app replicates.
All row/cell references are from the main calculation sheet `"."` unless stated otherwise.

---

## 1. Workbook Structure (35 Sheets)

| #   | Sheet Name              | Purpose                                             |
| --- | ----------------------- | --------------------------------------------------- |
| 1   | `.`                     | **Main calculation sheet** — all formulas live here |
| 2   | `PETICION DATOS LUZ`    | **Electricity input form** — user-facing data entry |
| 3   | `PETICION DATOS GAS`    | **Gas input form** — user-facing data entry         |
| 4   | `COMPARATIVA LUZ`       | Output comparison table for electricity             |
| 5   | `COMPARATIVA GAS`       | Output comparison table for gas                     |
| 6   | `BASE DE DATOS FIJO`    | Fixed electricity price database                    |
| 7   | `BASE DE DATOS INDEX`   | Indexed electricity price database                  |
| 8   | `Estable (Fijo)`        | Specific product: Estable fixed rates               |
| 9   | `PRECIOS FIJOS GAS`     | Fixed gas price database                            |
| 10  | `BOLETIN DE PEDIDO LUZ` | Electricity order form template                     |
| 11  | `BOLETIN DE PEDIDO GAS` | Gas order form template                             |
| 12  | `RL01 PENINSULA`        | Gas tariff RL01 Peninsula rates                     |
| 13  | `RL02 PENINSULA`        | Gas tariff RL02 Peninsula rates                     |
| 14  | `RL03 PENINSULA`        | Gas tariff RL03 Peninsula rates                     |
| 15  | `RL04 PENINSULA`        | Gas tariff RL04 Peninsula rates                     |
| 16  | `RL05 PENINSULA`        | Gas tariff RL05 Peninsula rates                     |
| 17  | `RL06 PENINSULA`        | Gas tariff RL06 Peninsula rates                     |
| 18  | `RLPS1`                 | Gas tariff RLPS1 rates                              |
| 19  | `RLPS2`                 | Gas tariff RLPS2 rates                              |
| 20  | `RLPS3`                 | Gas tariff RLPS3 rates                              |
| 21  | `RLPS4`                 | Gas tariff RLPS4 rates                              |
| 22  | `RLPS5`                 | Gas tariff RLPS5 rates                              |
| 23  | `RLPS6`                 | Gas tariff RLPS6 rates                              |
| 24  | `Dinamica (Index) LUZ`  | Indexed electricity product: Dinámica               |
| 25  | `OMIE`                  | OMIE monthly average prices (€/MWh)                 |
| 26  | `MIBGAS`                | MIBGAS monthly average prices (€/kWh)               |
| 27  | `IH`                    | Gas infrastructure charge (IH) rate                 |
| 28  | `PORTADA`               | Cover/title sheet                                   |
| 29  | `PORTADA GAS`           | Gas cover/title sheet                               |
| 30  | `PIN`                   | PIN/authentication sheet                            |
| 31  | `CONTROL`               | Internal control panel                              |
| 32  | `VALIDACIONES`          | Data validation lists                               |
| 33  | `CONFIGURACION`         | Configuration settings                              |
| 34  | `HISTORIAL`             | Price history                                       |
| 35  | `AUXILIAR`              | Auxiliary calculations                              |

---

## 2. Electricity Inputs — `PETICION DATOS LUZ`

Fields as they appear in the Excel input form:

| Cell | Field                         | Type                                      | App Field                     |
| ---- | ----------------------------- | ----------------------------------------- | ----------------------------- |
| E3   | CUPS                          | Text                                      | `cups`                        |
| E4   | Nombre del titular            | Text                                      | `nombreTitular`               |
| E5   | Persona de contacto           | Text                                      | `personaContacto`             |
| E6   | Comercial                     | Text                                      | `comercial`                   |
| E7   | Dirección                     | Text                                      | `direccion`                   |
| E8   | Consumo anual estimado        | Number (kWh)                              | `consumoAnual`                |
| E9   | Comercializador actual        | Text                                      | `comercializadorActual`       |
| E10  | Tarifa de acceso              | Dropdown: 2.0TD / 3.0TD / 6.1TD           | `tarifaAcceso`                |
| E11  | Zona geográfica               | Dropdown: Peninsula / Baleares / Canarias | `zonaGeografica`              |
| E12  | Perfil de carga               | Dropdown: NORMAL / DIURNO                 | `perfilCarga`                 |
| D24  | Fecha inicio factura          | Date                                      | `fechaInicio`                 |
| E24  | Fecha fin factura             | Date                                      | `fechaFin`                    |
| E25  | Días del período              | Formula: `=(E24-D24)+1` (**inclusive**)   | `dias` (calculated)           |
| E28  | Potencia contratada P1 (kW)   | Number                                    | `potenciaContratada.P1`       |
| E29  | Potencia contratada P2 (kW)   | Number                                    | `potenciaContratada.P2`       |
| E30  | Potencia contratada P3 (kW)   | Number                                    | `potenciaContratada.P3`       |
| E31  | Potencia contratada P4 (kW)   | Number                                    | `potenciaContratada.P4`       |
| E32  | Potencia contratada P5 (kW)   | Number                                    | `potenciaContratada.P5`       |
| E33  | Potencia contratada P6 (kW)   | Number                                    | `potenciaContratada.P6`       |
| E35  | Exceso de potencia (€)        | Number — **direct € from invoice**        | `excesoPotencia` (€)          |
| E37  | Consumo P1 (kWh)              | Number                                    | `consumo.P1`                  |
| E38  | Consumo P2 (kWh)              | Number                                    | `consumo.P2`                  |
| E39  | Consumo P3 (kWh)              | Number                                    | `consumo.P3`                  |
| E40  | Consumo P4 (kWh)              | Number                                    | `consumo.P4`                  |
| E41  | Consumo P5 (kWh)              | Number                                    | `consumo.P5`                  |
| E42  | Consumo P6 (kWh)              | Number                                    | `consumo.P6`                  |
| E44  | Energía reactiva (€)          | Number                                    | `extras.reactiva`             |
| E46  | OMIE P1 estimado (€/kWh)      | Number                                    | `omieEstimado.P1`             |
| E47  | OMIE P2–P6 estimado (€/kWh)   | Number                                    | `omieEstimado.P2–P6`          |
| E48  | Alquiler equipo de medida (€) | Number                                    | `extras.alquilerEquipoMedida` |
| E49  | Otros cargos / IMP RDL (€)    | Number                                    | `extras.otrosCargos`          |
| E51  | Factura actual total (€)      | Number                                    | `facturaActual`               |

> **Note on E35 (Exceso de potencia):** The Excel treats this as a plain € amount copied
> from the client's current invoice. It is a regulatory grid penalty for exceeding contracted
> power, set by the regulator — **not recalculated per supplier**. The simulator passes it
> through unchanged to show it as part of the new bill.

---

## 3. Gas Inputs — `PETICION DATOS GAS`

| Cell | Field                         | Type                                         | App Field                     |
| ---- | ----------------------------- | -------------------------------------------- | ----------------------------- |
| E3   | CUPS                          | Text                                         | `cups`                        |
| E4   | Nombre del titular            | Text                                         | `nombreTitular`               |
| E5   | Tarifa de acceso              | Dropdown: RL01–RL06, RLPS1–RLPS6             | `tarifaAcceso`                |
| E6   | Zona geográfica               | Dropdown: Peninsula / Baleares               | `zonaGeografica`              |
| D14  | Fecha inicio factura          | Date                                         | `fechaInicio`                 |
| E14  | Fecha fin factura             | Date                                         | `fechaFin`                    |
| E15  | Días del período              | Formula: `=E14-D14` (**exclusive** end date) | `dias` (calculated)           |
| E17  | Consumo total (kWh)           | Number                                       | `consumo`                     |
| E19  | Telemedida                    | Dropdown: SI / NO                            | `telemedida`                  |
| E21  | Alquiler equipo de medida (€) | Number                                       | `extras.alquilerEquipoMedida` |
| E22  | Otros cargos (€)              | Number                                       | `extras.otrosCargos`          |
| E24  | Factura actual total (€)      | Number                                       | `facturaActual`               |

> **Note on days calculation:** Gas uses `E14-D14` (exclusive), while electricity uses
> `(E24-D24)+1` (inclusive). This is an intentional difference in the Excel model.

---

## 4. Main Calculation Sheet `"."`

### 4.1 Electricity Calculation Block (rows ~1270–1665)

The sheet calculates each product variant (e.g., ESTABLE N1, ESTABLE N2, DINAMICA N1…)
as a vertical block. Each block follows this structure:

#### Electricity Fixed Product Block

```
Row  | Description                          | Formula / Value
-----|--------------------------------------|------------------------------------------
1270 | Product label                        | "ESTABLE N1"
1271 | Tariff lookup row                    |
...  |                                      |
1295 | Término de energía P1 (€)            | =consumo_P1 × PRECIO_ENER_P1
1296 | Término de energía P2 (€)            | =consumo_P2 × PRECIO_ENER_P2
...  |                                      |
1299 | TOTAL TÉRMINO ENERGÍA                | =SUM(P1:P6)
1300 | Término de potencia P1 (€)           | =potencia_P1 × PRECIO_POT_P1 × (dias/365)
...  |                                      |
1305 | TOTAL TÉRMINO POTENCIA               | =SUM(P1:P6)
1306 | Exceso de potencia (€)               | ='PETICION DATOS LUZ'!$E$35  ← PASS-THROUGH
1307 | Reactiva (€)                         | ='PETICION DATOS LUZ'!$E$44
1308 | IMP RDL (otros cargos) (€)           | ='PETICION DATOS LUZ'!$E$49
1309 | IMPUESTO ELÉCTRICO (5.11%)           | =(E1299+E1305+E1306+E1307+E1308)×0.0511269632
                                             ← otrosCargos IS in the tax base
1310 | Alquiler equipo de medida (€)        | ='PETICION DATOS LUZ'!$E$48
                                             ← alquiler is NOT in the tax base
1311 | BASE IMPONIBLE IVA                   | =E1299+E1305+E1306+E1307+E1308+E1309+E1310
1312 | IVA (21%)                            | =E1311 × 0.21
1313 | TOTAL FACTURA                        | =E1311 + E1312  (= baseIVA × 1.21)
```

#### Electricity Indexed Product Block

Same structure but energy price = OMIE + margin per period:

```
terminoEnergia_P1 = consumo_P1 × (OMIE_P1 + MARGEN_P1)
```

Power pricing is the same formula as fixed (€/kW/year × kW × days/365).

### 4.2 Gas Calculation Block (rows ~2600–2680)

```
Row  | Description                          | Formula
-----|--------------------------------------|----------------------------------
2600 | Product label                        | "RL01 PENINSULA N1"
...  |
2610 | Término fijo (€)                     | =dias × PRECIO_DIA
2611 | Término variable (€)                 | =consumo × PRECIO_VAR
2612 | IH (cargo infraestructura) (€)       | =consumo × 0.00234  (IH rate)
2613 | BASE antes de IVA                    | =2610 + 2611 + 2612
2614 | Alquiler equipo de medida (€)        | pass-through from input
2615 | Otros cargos (€)                     | pass-through from input
2616 | IVA (21%)                            | =(2613+2614+2615) × 0.21
2617 | TOTAL FACTURA                        | =2613+2614+2615+2616
```

---

## 5. Tax Formulas (Critical — verified against Excel rows 1295–1315)

### Electricity Tax Stack

```
baseImponible  = Σ(terminoEnergia) + Σ(terminoPotencia) + excesoPotencia€
               + reactiva + otrosCargos

impElectrico   = baseImponible × 0.0511269632   (Impuesto Eléctrico 5.11%)

baseIva        = baseImponible + impElectrico + alquilerEquipoMedida

iva            = baseIva × 0.21

TOTAL          = baseIva × 1.21
```

**Key rules:**

- `otrosCargos` (IMP RDL, E49) → **inside** `baseImponible` (taxed at 5.11%)
- `alquilerEquipoMedida` (E48) → **outside** `baseImponible`, added to `baseIva` only

### Gas Tax Stack

Gas has no Impuesto Eléctrico equivalent:

```
baseIva  = terminoFijoDia × dias + consumo × precioVariable + consumo × IH(0.00234)
         + alquilerEquipoMedida + otrosCargos

iva      = baseIva × 0.21
TOTAL    = baseIva × 1.21
```

---

## 6. Price Databases

### 6.1 Electricity Fixed Prices — `Estable (Fijo)` sheet

Price table structure (example rows):

| Product | Tier | Tariff | Period | Energy (€/kWh) | Power (€/kW/year) |
| ------- | ---- | ------ | ------ | -------------- | ----------------- |
| ESTABLE | N1   | 3.0TD  | P1     | 0.1234         | 12.50             |
| ESTABLE | N1   | 3.0TD  | P2     | 0.0987         | 10.20             |
| ESTABLE | N2   | 3.0TD  | P1     | 0.1456         | 13.80             |
| ESTABLE | N3   | 3.0TD  | P1     | 0.1678         | 15.10             |

App key format: `ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:ENERGIA`
App key format: `ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA`

### 6.2 Gas Fixed Prices — `PRECIOS FIJOS GAS` sheet

| Product | Tier | Tariff | Zone      | Energy (€/kWh) | Fixed Day (€/day) |
| ------- | ---- | ------ | --------- | -------------- | ----------------- |
| FIJO    | N1   | RL01   | Peninsula | 0.0456         | 0.12              |
| FIJO    | N1   | RL02   | Peninsula | 0.0398         | 0.15              |

App key format: `GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:ENERGIA`
App key format: `GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:TERMINO_DIA`

### 6.3 Market References

| Sheet    | Key format           | Description                                             |
| -------- | -------------------- | ------------------------------------------------------- |
| `OMIE`   | `OMIE:{YYYY}-{MM}`   | Monthly OMIE average price (€/MWh → converted to €/kWh) |
| `MIBGAS` | `MIBGAS:{YYYY}-{MM}` | Monthly MIBGAS average price (€/kWh)                    |
| `IH`     | constant `0.00234`   | Infrastructure charge for gas (€/kWh)                   |

---

## 7. Product Tier Naming

| Excel Name    | App Tier Code | Description                               |
| ------------- | ------------- | ----------------------------------------- |
| N1 / SUPER    | `N1`          | Premium tier — lowest margin / best price |
| N2 / ESTÁNDAR | `N2`          | Standard tier                             |
| N3 / EXTRA    | `N3`          | Economy tier — highest margin             |

---

## 8. Period Mapping by Tariff

### Electricity

| Tariff | Energy Periods | Power Periods | Excess Periods |
| ------ | -------------- | ------------- | -------------- |
| 2.0TD  | P1, P2, P3     | P1, P2        | _(none)_       |
| 3.0TD  | P1–P6          | P1–P6         | P1, P2, P3     |
| 6.1TD  | P1–P6          | P1–P6         | P1, P2, P3     |

### Gas

| Tariff      | Term Structure                          |
| ----------- | --------------------------------------- |
| RL01–RL06   | Fixed daily term + variable energy term |
| RLPS1–RLPS6 | Fixed daily term + variable energy term |

---

## 9. Days Calculation Differences

| Energy Type | Excel Formula  | Rule                   | App Implementation                   |
| ----------- | -------------- | ---------------------- | ------------------------------------ |
| Electricity | `=(E24-D24)+1` | **Inclusive** end date | `Math.round((to-from)/86400000) + 1` |
| Gas         | `=E14-D14`     | **Exclusive** end date | `Math.round((to-from)/86400000)`     |

This is an intentional difference in the Excel model, not a bug.

---

## 10. Known Bugs Fixed (vs Original App)

### Bug 1: Days Off-by-One (Electricity)

- **Excel**: `(E24-D24)+1` — inclusive
- **Old app**: `Math.round(diff/86400000)` — exclusive (missing `+1`)
- **Fix**: Added `+1` to `daysBetween()` in `SimulationForm.tsx`

### Bug 2: `otrosCargos` Wrongly Excluded from Impuesto Eléctrico Base

- **Excel row 1309**: `IMP = (TOTAL_POT + TOTAL_ENER + exceso + reactiva + IMP_RDL) × 5.11%`
- **Old app**: `otrosCargos` was added to `baseIva` instead of `baseImponible`
- **Fix**: Moved `otrosCargos` into `baseImponible` in both `calcElecFijo` and `calcElecIndex`

### Bug 3: `excesoPotencia` Wrongly Recalculated

- **Excel E35**: Direct pass-through of the € amount from the client invoice
- **Old app**: Tried to recalculate `2 × price × kW × (days/365)` — wrong; this is a grid charge
- **Fix**: `excesoPotencia` is now typed as `number` (direct €), no recalculation applied
