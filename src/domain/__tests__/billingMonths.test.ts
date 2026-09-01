import { billingMonthsFromItems } from "../billingMonths";

describe("billingMonthsFromItems", () => {
  it("uses explicit workbook metadata and sorts newest first", () => {
    expect(billingMonthsFromItems([
      { key: "META:BILLING_MONTH:2025-12", valueText: "2025-12" },
      { key: "META:BILLING_MONTH:2026-01", valueText: "2026-01" },
      { key: "ELEC:INDEX:DINAMICA:N1:2.0TD:P1:MARGEN:2027-02" },
    ])).toEqual(["2026-01", "2025-12"]);
  });

  it("discovers months from price keys for legacy imports", () => {
    expect(billingMonthsFromItems([
      { key: "ELEC:INDEX:DINAMICA:N1:2.0TD:P1:MARGEN:2025-08" },
      { key: "ELEC:INDEX:DINAMICA:N1:2.0TD:P2:MARGEN:2026-07:PROFILE:NORMAL" },
      { key: "ELEC:INDEX:DINAMICA:N2:2.0TD:P1:MARGEN:2026-07" },
    ])).toEqual(["2026-07", "2025-08"]);
  });
});
