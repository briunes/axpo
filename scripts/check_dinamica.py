import openpyxl
import sys

wb = openpyxl.load_workbook('/Users/brunobarros/Projects/axpo/sim_open.xlsm', read_only=True, data_only=True)
ws = wb['DINAMICA N1']

cells = ['AW7','AX7','AY7','AW8','AX8','AY8','AW10','AX10','AY10',
         'AY15','AZ15','BA15','AY22','AZ46','AZ49',
         'AY29','AZ29','BA29',
         'AR15','AS15','AT15','AR29','AS29','AT29',
         'AT45','AU45','AV45',
         'L16','L17','L18','L19','L20','L21']

for c in cells:
    print(f'{c}: {ws[c].value}')

# Also check INPUT OMIE
ws2 = wb['INPUT OMIE']
print('\n=== INPUT OMIE row 14 AE-AG (DIURNO 2.0TD Jan2026) ===')
print('AE14:', ws2['AE14'].value)
print('AF14:', ws2['AF14'].value)
print('AG14:', ws2['AG14'].value)
print('BM7:', ws2['BM7'].value)
print('BN7:', ws2['BN7'].value)
print('BO7:', ws2['BO7'].value)
