import zipfile, xml.etree.ElementTree as ET, re, sys

fname = 'SIMULADOR AXPO 01.04.2026 (Pen, Islas) 1_v15 ABIERTO.xlsm'

def get_shared_strings(z):
    ss = []
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    for si in root.findall('x:si', ns):
        texts = si.findall('.//x:t', ns)
        ss.append(''.join(t.text or '' for t in texts))
    return ss

def get_sheet_data(z, sheet_num, shared_strings, max_rows=100):
    data = z.read(f'xl/worksheets/sheet{sheet_num}.xml')
    root = ET.fromstring(data)
    ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows_out = []
    for row in root.findall('.//x:row', ns):
        r_idx = int(row.attrib.get('r', 0))
        if r_idx > max_rows:
            break
        cells = {}
        for cell in row.findall('x:c', ns):
            ref = cell.attrib.get('r', '')
            t = cell.attrib.get('t', '')
            v_el = cell.find('x:v', ns)
            f_el = cell.find('x:f', ns)
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

target_sheets = sys.argv[1:] if len(sys.argv) > 1 else [
    'PETICION DATOS LUZ',
    'PETICION DATOS GAS',
    'BASE DE DATOS FIJO',
    'BASE DE DATOS INDEX',
    'COMPARATIVA LUZ',
    'COMPARATIVA GAS',
]

with zipfile.ZipFile(fname, 'r') as z:
    ss = get_shared_strings(z)
    smap = get_sheet_map(z)

    for sheet_name in target_sheets:
        num = smap.get(sheet_name)
        if num is None:
            print(f'\n=== {sheet_name}: NOT FOUND ===')
            continue
        print(f'\n{"="*60}')
        print(f'SHEET: {sheet_name} (file: sheet{num}.xml)')
        print('='*60)
        rows = get_sheet_data(z, num, ss, max_rows=120)
        for r_idx, cells in rows:
            parts = [f'{k}={repr(v)}' for k, v in sorted(cells.items()) if v and v.strip()]
            if parts:
                print(f'  R{r_idx:3d}: ' + '  |  '.join(parts))
