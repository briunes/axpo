import openpyxl

def read_base_fijo(filename):
    wb = openpyxl.load_workbook(filename, read_only=True, data_only=True)
    ws = wb["BASE DE DATOS FIJO"]
    rows = []
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=200, values_only=True), start=1):
        vals = list(row)
        non_none = [(idx, v) for idx, v in enumerate(vals) if v is not None]
        if non_none:
            rows.append((i, non_none))
    return rows

print("=== sim_open.xlsm BASE DE DATOS FIJO ===")
for rownum, nn in read_base_fijo("/Users/brunobarros/Projects/axpo/sim_open.xlsm"):
    print(f"Row {rownum}: {nn[:20]}")

print("\n=== open_file.xlsm BASE DE DATOS FIJO ===")
for rownum, nn in read_base_fijo("/Users/brunobarros/Projects/axpo/open_file.xlsm"):
    print(f"Row {rownum}: {nn[:20]}")
