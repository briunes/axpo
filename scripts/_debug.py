import zipfile, xml.etree.ElementTree as ET

ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

with zipfile.ZipFile('live_base_data.xlsm', 'r') as z:
    shared_strings = []
    try:
        sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in sst.findall('.//x:si', ns):
            t = ''.join(x.text or '' for x in si.findall('.//x:t', ns))
            shared_strings.append(t)
    except:
        pass

    with z.open('xl/worksheets/sheet2.xml') as f:
        sheet = ET.fromstring(f.read())

    rows = sheet.findall('.//x:row', ns)
    print("=== '.' sheet — rows with 'PERSONALIZADA OMIE' anywhere ===")
    matches = 0
    for row in rows:
        r_idx = int(row.attrib.get('r', '0'))
        for cell in row.findall('x:c', ns):
            ref = cell.attrib.get('r', '')
            t = cell.attrib.get('t', '')
            v_el = cell.find('x:v', ns)
            f_el = cell.find('x:f', ns)
            val = ''
            if f_el is not None:
                val = f'F: {f_el.text}'
            elif v_el is not None:
                if t == 's':
                    idx = int(v_el.text)
                    val = shared_strings[idx] if idx < len(shared_strings) else f'[{idx}]'
                else:
                    val = v_el.text
            if val and 'PERSONALIZADA OMIE' in val.upper():
                if matches < 5:
                    print(f'  Row {r_idx} {ref}: {val[:200]}')
                matches += 1
    print(f'\nTotal cells with PERSONALIZADA OMIE: {matches}')

    # Also check rows 5-30 of column A to see how the lookup key is built
    print('\n=== . sheet — first 50 rows of col A through P (key structure) ===')
    for row in rows:
        r_idx = int(row.attrib.get('r', '0'))
        if r_idx < 5 or r_idx > 30:
            continue
        # Only show first 16 cols (A..P)
        row_data = []
        for cell in row.findall('x:c', ns):
            ref = cell.attrib.get('r', '')
            col = re.sub(r'\d+', '', ref)
            if col > 'P':
                continue
            t = cell.attrib.get('t', '')
            v_el = cell.find('x:v', ns)
            f_el = cell.find('x:f', ns)
            val = ''
            if f_el is not None:
                val = f'F: {f_el.text}'
            elif v_el is not None:
                if t == 's':
                    idx = int(v_el.text)
                    val = shared_strings[idx] if idx < len(shared_strings) else f'[{idx}]'
                else:
                    val = v_el.text
            if val:
                row_data.append(f'{ref}={val[:60]}')
        if row_data:
            print('  ', '  |  '.join(row_data))
