"""
Analyzes the Excel price tables to understand full structure before writing the importer.
"""
import zipfile
import xml.etree.ElementTree as ET
import re
import sys

FNAME = 'SIMULADOR AXPO 01.04.2026 (Pen, Islas) 1_v15 ABIERTO.xlsm'

def get_shared_strings(z):
    ss = []
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    for si in root.findall('x:si', ns):
        texts = si.findall('.//x:t', ns)
        ss.append(''.join(t.text or '' for t in texts))
    return ss

def get_sheet_map(z):
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rels_xml = z.read('xl/_rels/workbook.xml.rels')
    rels_root = ET.fromstring(rels_xml)
    rid_to_file = {}
    for rel in rels_root:
        rid_to_file[rel.attrib['Id']] = rel.attrib['Target']
    result = {}
    for s in wb.findall('.//x:sheet', ns):
        name = s.attrib['name']
        rid = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = rid_to_file.get(rid, '')
        m = re.search(r'sheet(\d+)\.xml', target)
        if m:
            result[name] = int(m.group(1))
    return result

def get_sheet_rows(z, sheet_num, shared_strings, min_row=1, max_rows=400):
    data = z.read(f'xl/worksheets/sheet{sheet_num}.xml')
    root = ET.fromstring(data)
    ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows_out = []
    for row in root.findall('.//x:row', ns):
        r_idx = int(row.attrib.get('r', 0))
        if r_idx < min_row or r_idx > max_rows:
            continue
        cells = {}
        for cell in row.findall('x:c', ns):
            ref = cell.attrib.get('r', '')
            t = cell.attrib.get('t', '')
            v_el = cell.find('x:v', ns)
            if v_el is not None and v_el.text is not None:
                if t == 's':
                    val = shared_strings[int(v_el.text)]
                else:
                    val = v_el.text
            else:
                val = ''
            col = ''.join(c for c in ref if c.isalpha())
            cells[col] = val
        if cells:
            rows_out.append((r_idx, cells))
    return rows_out

def print_rows(rows, min_r=1, max_r=9999):
    for r_idx, cells in rows:
        if r_idx < min_r or r_idx > max_r:
            continue
        parts = [f'{k}={repr(v[:40] if len(v) > 40 else v)}' for k, v in sorted(cells.items()) if v and v.strip()]
        if parts:
            print(f'  R{r_idx:3d}: ' + '  |  '.join(parts))

with zipfile.ZipFile(FNAME, 'r') as z:
    ss = get_shared_strings(z)
    smap = get_sheet_map(z)

    mode = sys.argv[1] if len(sys.argv) > 1 else 'fijo_tail'

    if mode == 'fijo_tail':
        print("=== BASE DE DATOS FIJO rows 118-200 (Baleares?) ===")
        rows = get_sheet_rows(z, smap['BASE DE DATOS FIJO'], ss, min_row=118, max_rows=200)
        print_rows(rows)

    elif mode == 'index':
        print("=== BASE DE DATOS INDEX rows 1-120 ===")
        rows = get_sheet_rows(z, smap['BASE DE DATOS INDEX'], ss, min_row=1, max_rows=120)
        print_rows(rows)

    elif mode == 'gas_fixed':
        print("=== PRECIOS FIJOS GAS ===")
        rows = get_sheet_rows(z, smap['PRECIOS FIJOS GAS'], ss, min_row=1, max_rows=100)
        print_rows(rows)

    elif mode == 'gas_index':
        print("=== PRECIOS INDEX GAS ===")
        rows = get_sheet_rows(z, smap['PRECIOS INDEX GAS'], ss, min_row=1, max_rows=100)
        print_rows(rows)

    elif mode == 'all_sheets':
        print("All sheet names:", list(smap.keys()))
