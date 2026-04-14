"""
parse-xlsm-prices.py
Reads the AXPO pricing Excel file and outputs base-values-seed.json

Key naming convention:
  ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:ENERGIA   → €/kWh
  ELEC:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA  → €/kW/año (normalised)
  ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:MARGEN   → €/kWh margin over OMIE
  ELEC:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{PERIODO}:POTENCIA → €/kW/año
  GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:ENERGIA       → €/kWh
  GAS:FIJO:{PRODUCT}:{TIER}:{TARIFA}:TERMINO_DIA          → €/día (BOE tariffs only)
  GAS:INDEX:{PRODUCT}:{TIER}:{TARIFA}:{ZONA}:MARGEN       → €/kWh margin over MIBGAS
  MIBGAS:{YYYY}-{MM}                                       → €/kWh MIBGAS monthly avg

  TIER codes : N1 (Super), N2 (Estándar), N3 (Extra)
  ZONA codes : PEN (Península), BAL (Baleares)
  TARIFA     : 2.0TD | 3.0TD | 6.1TD  (elec)
             | RL01..RL06 | RLPS1..RLPS6  (gas)
"""

import zipfile
import xml.etree.ElementTree as ET
import re
import json
import os

FNAME = "SIMULADOR AXPO 01.04.2026 (Pen, Islas) 1_v15 ABIERTO.xlsm"
OUT_FILE = "scripts/base-values-seed.json"

# --------------------------------------------------------------------------- #
# Excel reader helpers
# --------------------------------------------------------------------------- #

def get_shared_strings(z):
    ss = []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    for si in root.findall("x:si", ns):
        texts = si.findall(".//x:t", ns)
        ss.append("".join(t.text or "" for t in texts))
    return ss


def get_sheet_map(z):
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rels_xml = z.read("xl/_rels/workbook.xml.rels")
    rels_root = ET.fromstring(rels_xml)
    rid_to_file = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_root}
    result = {}
    for s in wb.findall(".//x:sheet", ns):
        name = s.attrib["name"]
        rid = s.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        )
        target = rid_to_file.get(rid, "")
        m = re.search(r"sheet(\d+)\.xml", target)
        if m:
            result[name] = int(m.group(1))
    return result


def read_sheet(z, sheet_num, shared_strings, max_rows=300):
    """Returns {row_idx: {col_letter: value_string}}"""
    data = z.read(f"xl/worksheets/sheet{sheet_num}.xml")
    root = ET.fromstring(data)
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    result = {}
    for row in root.findall(".//x:row", ns):
        r_idx = int(row.attrib.get("r", 0))
        if r_idx > max_rows:
            break
        cells = {}
        for cell in row.findall("x:c", ns):
            ref = cell.attrib.get("r", "")
            t = cell.attrib.get("t", "")
            v_el = cell.find("x:v", ns)
            if v_el is not None and v_el.text is not None:
                val = shared_strings[int(v_el.text)] if t == "s" else v_el.text
            else:
                val = ""
            col = "".join(c for c in ref if c.isalpha())
            cells[col] = val
        if cells:
            result[r_idx] = cells
    return result


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def safe_float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def col_to_p(col, base_col):
    """Convert column letter to period label given the base column for P1."""
    offset = ord(col) - ord(base_col)
    if 0 <= offset <= 5:
        return f"P{offset + 1}"
    return None


ELEC_TARIFFS = {"2.0TD", "3.0TD", "6.1TD"}
GAS_TARIFFS = {
    "RL01", "RL02", "RL03", "RL04", "RL05", "RL06",
    "RLPS1", "RLPS2", "RLPS3", "RLPS4", "RLPS5", "RLPS6",
}

# --------------------------------------------------------------------------- #
# FIJO sheet parser
# --------------------------------------------------------------------------- #

# Column layout in FIJO sheet:
#   N1 group: tariff=A, P1-P6 = B-G
#   N2 group: tariff=I, P1-P6 = J-O
#   N3 group: tariff=Q, P1-P6 = R-W
N1_COLS = list("BCDEFG")
N2_COLS = list("JKLMNO")
N3_COLS = list("RSTUVW")

FIJO_PRODUCT_NAMES = {
    "ESTABLE":               "ESTABLE",
    "ESTABLE PLUS":          "ESTABLE_PLUS",
    "1P PLUS (Periodo Único)":   "1P_PLUS",
    "1P PLUS XL (Periodo Único)": "1P_PLUS_XL",
    "ESTABLE TALLERES":      "ESTABLE_TALLERES",
    "ESTABLE PLUS TALLERES": "ESTABLE_PLUS_TALLERES",
}


def detect_power_unit(s):
    """Detect normalisation factor from a label like '€/kWdía', '€/kWmes', '€/kWaño'."""
    s = s.lower()
    if "día" in s or "dia" in s or "/dia" in s:
        return "día"
    if "mes" in s:
        return "mes"
    return "año"


def parse_fijo(rows):
    items = []

    # Find product block start rows (product name only in col K)
    product_starts = []
    for r, cells in sorted(rows.items()):
        non_empty = {k: v.strip() for k, v in cells.items() if v.strip()}
        if len(non_empty) == 1 and "K" in non_empty:
            raw_name = non_empty["K"]
            # Strip trailing parenthetical e.g. " (Periodo Único)"
            clean_name = re.sub(r"\s*\(.*?\)\s*$", "", raw_name).strip()
            slug = FIJO_PRODUCT_NAMES.get(raw_name) or FIJO_PRODUCT_NAMES.get(clean_name)
            if slug:
                product_starts.append((r, slug))

    for idx, (start, slug) in enumerate(product_starts):
        end = product_starts[idx + 1][0] if idx + 1 < len(product_starts) else start + 25

        # Find POTENCIAS separator row
        potencias_row = None
        for r in range(start, end):
            cells = rows.get(r, {})
            for v in cells.values():
                if "POTENCIAS" in v.upper():
                    potencias_row = r
                    break
            if potencias_row:
                break

        # Parse energy rows (between start and potencias_row)
        energy_end = potencias_row if potencias_row else end
        for r in range(start, energy_end):
            cells = rows.get(r, {})
            tariff = cells.get("A", "").strip()
            if tariff not in ELEC_TARIFFS:
                continue
            for tier, base_col, col_list in [("N1", "B", N1_COLS), ("N2", "J", N2_COLS), ("N3", "R", N3_COLS)]:
                for i, col in enumerate(col_list):
                    val = cells.get(col, "").strip()
                    if val:
                        v = safe_float(val)
                        if v is not None:
                            items.append({
                                "key": f"ELEC:FIJO:{slug}:{tier}:{tariff}:P{i + 1}:ENERGIA",
                                "valueNumeric": round(v, 10),
                                "unit": "€/kWh",
                            })

        # Parse power unit row (first row after potencias_row that mentions €/kW)
        unit_n1 = unit_n2 = unit_n3 = "año"
        if potencias_row:
            for r in range(potencias_row + 1, end):
                cells = rows.get(r, {})
                a = cells.get("A", "")
                i_val = cells.get("I", "")
                q_val = cells.get("Q", "")
                if "€/kW" in a or "€/KW" in a:
                    unit_n1 = detect_power_unit(a)
                    unit_n2 = detect_power_unit(i_val) if i_val else "año"
                    unit_n3 = detect_power_unit(q_val) if q_val else "año"
                    break

        # Parse power rows (after potencias_row)
        if potencias_row:
            for r in range(potencias_row + 1, end):
                cells = rows.get(r, {})
                tariff = cells.get("A", "").strip()
                if tariff not in ELEC_TARIFFS:
                    continue
                unit_map = {"N1": unit_n1, "N2": unit_n2, "N3": unit_n3}
                for tier, base_col, col_list in [("N1", "B", N1_COLS), ("N2", "J", N2_COLS), ("N3", "R", N3_COLS)]:
                    for i, col in enumerate(col_list):
                        val = cells.get(col, "").strip()
                        if val:
                            v = safe_float(val)
                            if v is not None:
                                # Normalise to €/kW/año
                                unit = unit_map[tier]
                                if unit == "día":
                                    v *= 365
                                elif unit == "mes":
                                    v *= 12
                                items.append({
                                    "key": f"ELEC:FIJO:{slug}:{tier}:{tariff}:P{i + 1}:POTENCIA",
                                    "valueNumeric": round(v, 8),
                                    "unit": "€/kW/año",
                                })

    return items


# --------------------------------------------------------------------------- #
# INDEX sheet parser
# --------------------------------------------------------------------------- #

# Column layout in INDEX sheet (one product+tier per block):
#   energy cols: tariff=A, P1-P6 = B-G
#   power cols (current year): tariff=J, P1-P6 = K-P
#   power cols (prev year):    tariff=T, P1-P6 = U-Z  (ignored)

INDEX_ENERGY_COLS = list("BCDEFG")
INDEX_POWER_COLS = list("KLMNOP")  # K=P1 ... P=P6

INDEX_PRODUCT_MAP = {
    "Dinamica Control":       "DINAMICA_CONTROL",
    "Dinamica Control Plus":  "DINAMICA_CONTROL_PLUS",
    "Dinamica Control Techo": "DINAMICA_CONTROL_TECHO",
    "Dinamica":               "DINAMICA",
    "Dinamica Plus":          "DINAMICA_PLUS",
}


def parse_index_product_tier(raw):
    """'Dinamica Control N1' → ('DINAMICA_CONTROL', 'N1')"""
    raw = raw.strip()
    m = re.match(r"^(.*?)\s+(N[123])$", raw)
    if not m:
        return None, None
    product_raw = m.group(1).strip()
    tier = m.group(2)
    slug = INDEX_PRODUCT_MAP.get(product_raw)
    return slug, tier


def parse_index(rows):
    items = []

    # Product blocks: single non-empty value in col A that matches product pattern
    product_starts = []
    for r, cells in sorted(rows.items()):
        non_empty = {k: v.strip() for k, v in cells.items() if v.strip()}
        # Product name row: only col A has content, and it matches our pattern
        if len(non_empty) == 1 and "A" in non_empty:
            slug, tier = parse_index_product_tier(non_empty["A"])
            if slug and tier:
                product_starts.append((r, slug, tier))

    for idx, (start, slug, tier) in enumerate(product_starts):
        end = product_starts[idx + 1][0] if idx + 1 < len(product_starts) else start + 10

        for r in range(start, end):
            cells = rows.get(r, {})
            tariff = cells.get("A", "").strip()
            if tariff not in ELEC_TARIFFS:
                continue

            # Energy margin (cols B-G = P1-P6)
            for i, col in enumerate(INDEX_ENERGY_COLS):
                val = cells.get(col, "").strip()
                if val:
                    v = safe_float(val)
                    if v is not None:
                        items.append({
                            "key": f"ELEC:INDEX:{slug}:{tier}:{tariff}:P{i + 1}:MARGEN",
                            "valueNumeric": round(v, 10),
                            "unit": "€/kWh",
                        })

            # Power (cols K-P = P1-P6, current year)
            tariff_j = cells.get("J", "").strip()
            if tariff_j in ELEC_TARIFFS:
                for i, col in enumerate(INDEX_POWER_COLS):
                    val = cells.get(col, "").strip()
                    if val:
                        v = safe_float(val)
                        if v is not None:
                            items.append({
                                "key": f"ELEC:INDEX:{slug}:{tier}:{tariff_j}:P{i + 1}:POTENCIA",
                                "valueNumeric": round(v, 8),
                                "unit": "€/kW/año",
                            })

    return items


# --------------------------------------------------------------------------- #
# GAS FIJO sheet parser
# --------------------------------------------------------------------------- #

GAS_FIJO_PRODUCT_MAP = {
    "Fijo N1":         ("FIJO",         "N1"),
    "Fijo N2":         ("FIJO",         "N2"),
    "Fijo N3":         ("FIJO",         "N3"),
    "ESTABLE PLUS N1": ("ESTABLE_PLUS",  "N1"),
    "ESTABLE PLUS N2": ("ESTABLE_PLUS",  "N2"),
    "ESTABLE PLUS N3": ("ESTABLE_PLUS",  "N3"),
}


def parse_gas_fijo(rows):
    items = []

    # Find product block start rows: isolated col A value matching known products
    product_starts = []
    for r, cells in sorted(rows.items()):
        non_empty = {k: v.strip() for k, v in cells.items() if v.strip()}
        if "A" in non_empty:
            a = non_empty["A"]
            if a in GAS_FIJO_PRODUCT_MAP and len(non_empty) <= 2:
                product_starts.append((r, a))

    for idx, (start, raw_name) in enumerate(product_starts):
        end = product_starts[idx + 1][0] if idx + 1 < len(product_starts) else start + 20
        slug, tier = GAS_FIJO_PRODUCT_MAP[raw_name]

        for r in range(start, end):
            cells = rows.get(r, {})

            # Energy price: col A = RL/RLPS tariff (Peninsula), col B = €/kWh
            tariff_pen = cells.get("A", "").strip()
            if tariff_pen in GAS_TARIFFS:
                v = safe_float(cells.get("B", ""))
                if v is not None:
                    items.append({
                        "key": f"GAS:FIJO:{slug}:{tier}:{tariff_pen}:PEN:ENERGIA",
                        "valueNumeric": round(v, 10),
                        "unit": "€/kWh",
                    })

            # Baleares energy: col E = tariff, col F = €/kWh
            tariff_bal = cells.get("E", "").strip()
            if tariff_bal in GAS_TARIFFS:
                v = safe_float(cells.get("F", ""))
                if v is not None:
                    items.append({
                        "key": f"GAS:FIJO:{slug}:{tier}:{tariff_bal}:BAL:ENERGIA",
                        "valueNumeric": round(v, 10),
                        "unit": "€/kWh",
                    })

            # Fixed term for RL tariffs: col I = tariff, J = €/día, K = €/año
            tariff_rl = cells.get("I", "").strip()
            if tariff_rl.startswith("RL") and tariff_rl in GAS_TARIFFS:
                v_dia = safe_float(cells.get("J", ""))
                v_anio = safe_float(cells.get("K", ""))
                if v_dia is not None:
                    items.append({
                        "key": f"GAS:FIJO:{slug}:{tier}:{tariff_rl}:TERMINO_DIA",
                        "valueNumeric": round(v_dia, 10),
                        "unit": "€/día",
                    })
                if v_anio is not None:
                    items.append({
                        "key": f"GAS:FIJO:{slug}:{tier}:{tariff_rl}:TERMINO_ANIO",
                        "valueNumeric": round(v_anio, 6),
                        "unit": "€/año",
                    })

            # Fixed term for RLPS tariffs: col M = tariff, N = €/día, O = €/año
            tariff_rlps = cells.get("M", "").strip()
            if tariff_rlps.startswith("RLPS") and tariff_rlps in GAS_TARIFFS:
                v_dia = safe_float(cells.get("N", ""))
                v_anio = safe_float(cells.get("O", ""))
                if v_dia is not None:
                    items.append({
                        "key": f"GAS:FIJO:{slug}:{tier}:{tariff_rlps}:TERMINO_DIA",
                        "valueNumeric": round(v_dia, 10),
                        "unit": "€/día",
                    })
                if v_anio is not None:
                    items.append({
                        "key": f"GAS:FIJO:{slug}:{tier}:{tariff_rlps}:TERMINO_ANIO",
                        "valueNumeric": round(v_anio, 6),
                        "unit": "€/año",
                    })

    return items


# --------------------------------------------------------------------------- #
# GAS INDEX sheet parser
# --------------------------------------------------------------------------- #

GAS_INDEX_PRODUCT_MAP = {
    "Indexado N1":      ("INDEXADO",      "N1"),
    "Indexado N2":      ("INDEXADO",      "N2"),
    "Indexado N3":      ("INDEXADO",      "N3"),
    "Dinamica plus N1": ("DINAMICA_PLUS", "N1"),
    "Dinamica plus N2": ("DINAMICA_PLUS", "N2"),
    "Dinamica plus N3": ("DINAMICA_PLUS", "N3"),
}

MONTH_ES_TO_NUM = {
    "ENERO": "01", "FEBRERO": "02", "MARZO": "03", "ABRIL": "04",
    "MAYO": "05", "JUNIO": "06", "JULIO": "07", "AGOSTO": "08",
    "SEPTIEMBRE": "09", "OCTUBRE": "10", "NOVIEMBRE": "11", "DICIEMBRE": "12",
}


def parse_mibgas_month(label):
    """'ENERO-26' → 'MIBGAS:2026-01',  'MARZO-25' → 'MIBGAS:2025-03'"""
    m = re.match(r"([A-Z]+)-(\d{2})$", label.strip().upper())
    if not m:
        return None
    month_es, yy = m.group(1), m.group(2)
    month_num = MONTH_ES_TO_NUM.get(month_es)
    if not month_num:
        return None
    year = f"20{yy}"
    return f"MIBGAS:{year}-{month_num}"


def parse_gas_index(rows):
    items = []

    # Find product block start rows
    product_starts = []
    for r, cells in sorted(rows.items()):
        non_empty = {k: v.strip() for k, v in cells.items() if v.strip()}
        if "A" in non_empty:
            a = non_empty["A"]
            if a in GAS_INDEX_PRODUCT_MAP and len(non_empty) <= 2:
                product_starts.append((r, a))

    for idx, (start, raw_name) in enumerate(product_starts):
        end = product_starts[idx + 1][0] if idx + 1 < len(product_starts) else start + 20
        slug, tier = GAS_INDEX_PRODUCT_MAP[raw_name]

        for r in range(start, end):
            cells = rows.get(r, {})

            # Margin: col A = tariff, B = €/kWh Peninsula
            tariff_pen = cells.get("A", "").strip()
            if tariff_pen in GAS_TARIFFS:
                v = safe_float(cells.get("B", ""))
                if v is not None:
                    items.append({
                        "key": f"GAS:INDEX:{slug}:{tier}:{tariff_pen}:PEN:MARGEN",
                        "valueNumeric": round(v, 10),
                        "unit": "€/kWh",
                    })

            # Baleares: col E = tariff, F = €/kWh
            tariff_bal = cells.get("E", "").strip()
            if tariff_bal in GAS_TARIFFS:
                v = safe_float(cells.get("F", ""))
                if v is not None:
                    items.append({
                        "key": f"GAS:INDEX:{slug}:{tier}:{tariff_bal}:BAL:MARGEN",
                        "valueNumeric": round(v, 10),
                        "unit": "€/kWh",
                    })

            # MIBGAS monthly data: col J = label, K = price (only in Indexado N1 block rows)
            mibgas_label = cells.get("J", "").strip()
            if mibgas_label and mibgas_label != "Mes":
                mibgas_key = parse_mibgas_month(mibgas_label)
                if mibgas_key:
                    v = safe_float(cells.get("K", ""))
                    if v is not None:
                        items.append({
                            "key": mibgas_key,
                            "valueNumeric": round(v, 10),
                            "unit": "€/kWh",
                        })

    return items


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main():
    if not os.path.exists(FNAME):
        print(f"ERROR: Excel file not found: {FNAME}")
        print("Run this script from the project root (backend/) directory.")
        return

    print(f"Reading {FNAME}...")
    with zipfile.ZipFile(FNAME, "r") as z:
        shared_strings = get_shared_strings(z)
        sheet_map = get_sheet_map(z)

        print(f"Sheets found: {list(sheet_map.keys())}")

        rows_fijo  = read_sheet(z, sheet_map["BASE DE DATOS FIJO"],  shared_strings, max_rows=130)
        rows_index = read_sheet(z, sheet_map["BASE DE DATOS INDEX"], shared_strings, max_rows=130)
        rows_gas_fijo  = read_sheet(z, sheet_map["PRECIOS FIJOS GAS"],  shared_strings, max_rows=110)
        rows_gas_index = read_sheet(z, sheet_map["PRECIOS INDEX GAS"], shared_strings, max_rows=110)

    print("Parsing BASE DE DATOS FIJO...")
    items_fijo = parse_fijo(rows_fijo)
    print(f"  → {len(items_fijo)} items")

    print("Parsing BASE DE DATOS INDEX...")
    items_index = parse_index(rows_index)
    print(f"  → {len(items_index)} items")

    print("Parsing PRECIOS FIJOS GAS...")
    items_gas_fijo = parse_gas_fijo(rows_gas_fijo)
    print(f"  → {len(items_gas_fijo)} items")

    print("Parsing PRECIOS INDEX GAS...")
    items_gas_index = parse_gas_index(rows_gas_index)
    print(f"  → {len(items_gas_index)} items")

    # Deduplicate by key (last one wins)
    all_items_dict = {}
    for item in items_fijo + items_index + items_gas_fijo + items_gas_index:
        all_items_dict[item["key"]] = item
    all_items = list(all_items_dict.values())

    print(f"\nTotal unique items: {len(all_items)}")

    # Sample output for sanity check
    print("\nSample keys (first 10):")
    for item in all_items[:10]:
        print(f"  {item['key']} = {item['valueNumeric']} {item['unit']}")

    mibgas_items = [i for i in all_items if i["key"].startswith("MIBGAS:")]
    print(f"\nMIBGAS entries ({len(mibgas_items)}):")
    for item in sorted(mibgas_items, key=lambda x: x["key"]):
        print(f"  {item['key']} = {item['valueNumeric']}")

    output = {
        "name": "AXPO Price Tables 2026-04",
        "scopeType": "GLOBAL",
        "sourceWorkbookRef": FNAME,
        "sourceScope": "ALL",
        "version": 1,
        "items": sorted(all_items, key=lambda x: x["key"]),
    }

    os.makedirs(os.path.dirname(OUT_FILE) if os.path.dirname(OUT_FILE) else ".", exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Written to {OUT_FILE}")


if __name__ == "__main__":
    main()
