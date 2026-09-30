import { prisma } from "@/infrastructure/database/prisma";
import { billingMonthsFromItems } from "@/domain/billingMonths";
import { getBaseValueBillingMonths } from "../baseValueBillingMonths";

jest.mock("@/infrastructure/database/prisma", () => ({ prisma: { baseValueItem: { findMany: jest.fn() } } }));
const findMany = prisma.baseValueItem.findMany as jest.Mock;
beforeEach(() => jest.resetAllMocks());

function useRows(rows: Array<{ key: string; valueText?: string | null }>) {
  findMany.mockImplementation(async ({ where }) => rows.filter(row =>
    where.OR ? row.key.startsWith("META:BILLING_MONTH:") || row.key.includes(":MARGEN:")
      : where.key.startsWith ? row.key.startsWith(where.key.startsWith)
      : row.key.includes(where.key.contains),
  ));
}

it("fetches only explicit months, skipping thousands of margin rows", async () => {
  const rows = [
    { key: "META:BILLING_MONTH:2026-07", valueText: "2026-07" },
    { key: "META:BILLING_MONTH:2026-08", valueText: null },
    ...Array.from({ length: 20000 }, (_, i) => ({ key: `ELEC:INDEX:${i}:MARGEN:2025-01` })),
  ];
  useRows(rows);
  expect(await getBaseValueBillingMonths("set")).toEqual(billingMonthsFromItems(rows));
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(findMany).toHaveBeenCalledWith({ where: { baseValueSetId: "set", key: { startsWith: "META:BILLING_MONTH:" } }, select: { key: true, valueText: true } });
});

it.each([
  [],
  [{ key: "META:BILLING_MONTH:2026-07", valueText: "invalid" }],
  [{ key: "META:BILLING_MONTH:invalid", valueText: "" }],
].map(metadata => ({ metadata })))("preserves legacy month discovery when explicit metadata is absent or invalid: %j", async ({ metadata }) => {
  const margins = [
    { key: "ELEC:INDEX:DINAMICA:N1:2.0TD:P1:MARGEN:2025-08" },
    { key: "ELEC:INDEX:DINAMICA:N1:3.0TD:P2:MARGEN:2026-06:PROFILE:NORMAL:ZONE:Peninsula" },
    { key: "ELEC:INDEX:DINAMICA:N2:6.1TD:P1:MARGEN:2026-07:PROFILE:DIURNO:ZONE:Canarias" },
    { key: "ELEC:INDEX:DINAMICA:N2:6.1TD:P1:MARGEN:2026-07:ZONE:Baleares" },
    { key: "GAS:INDEX:N1:MARGEN:2026-05" },
  ];
  useRows([...metadata, ...margins]);
  expect(await getBaseValueBillingMonths("legacy")).toEqual(billingMonthsFromItems([...metadata, ...margins]));
  expect(findMany).toHaveBeenNthCalledWith(2, { where: { baseValueSetId: "legacy", key: { contains: ":MARGEN:" } }, select: { key: true, valueText: true } });
});

it("keeps explicit valid values authoritative even alongside malformed metadata", async () => {
  const rows = [{ key: "META:BILLING_MONTH:2026-07", valueText: "invalid" }, { key: "META:BILLING_MONTH:2026-08", valueText: "2026-06" }, { key: "ELEC:MARGEN:2025-01" }];
  useRows(rows);
  expect(await getBaseValueBillingMonths("set")).toEqual(["2026-06"]);
  expect(findMany).toHaveBeenCalledTimes(1);
});

it("returns no months for an empty set", async () => {
  useRows([]);
  expect(await getBaseValueBillingMonths("empty")).toEqual([]);
});
