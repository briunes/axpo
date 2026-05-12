import sys

dump_file = "preview_dump_20260511_163200.sql"
out_file = "preview_simulations_only.sql"

with open(dump_file, 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

def extract_copy_block(lines, table_name):
    result = []
    in_block = False
    for line in lines:
        if line.startswith(f'COPY public.{table_name} ') or line.startswith(f'COPY public."{table_name}" '):
            in_block = True
        if in_block:
            result.append(line)
            if line.strip() == '\\.':
                break
    return result

sim_block = extract_copy_block(lines, 'simulations')
sim_versions_block = extract_copy_block(lines, 'simulation_versions')

with open(out_file, 'w') as f:
    f.write("-- Restore simulations from preview dump\n")
    f.write('TRUNCATE TABLE public."simulation_versions" CASCADE;\n')
    f.write('TRUNCATE TABLE public."simulations" CASCADE;\n\n')
    f.writelines(sim_block)
    f.write('\n')
    f.writelines(sim_versions_block)
    f.write('\n')

print(f"Written to {out_file}")
print(f"simulations COPY lines: {len(sim_block)}")
print(f"simulation_versions COPY lines: {len(sim_versions_block)}")
