import { incidentNotificationLanguage } from "../incidentNotificationLanguage";

describe("Incident language", () => {
  it.each([
    ["NEW", "New", "Nueva"], ["IN_REVIEW", "Ongoing", "En curso"],
    ["ESCALATED", "Escalated to App administrators", "Escalada a administradores de la aplicación"],
    ["RESOLVED", "Resolved", "Resuelta"], ["DISMISSED", "Dismissed", "Descartada"],
  ])("translates %s consistently with the incident UI", (status, en, es) => {
    expect(incidentNotificationLanguage("en").status(status)).toBe(en);
    expect(incidentNotificationLanguage("es").status(status)).toBe(es);
  });
  it.each([
    ["created", "Nueva incidencia"], ["status", "Cambio de estado de incidencia"],
    ["resolved", "Incidencia finalizada"], ["escalated", "Incidencia escalada a los administradores del sistema"],
  ] as const)("translates the %s title", (kind, title) => {
    expect(incidentNotificationLanguage("es").title(kind)).toBe(title);
  });
  it.each([" es-ES ", "ES", "es_MX"])("normalizes %s", (preference) => {
    expect(incidentNotificationLanguage(preference, "en").languageCode).toBe("es");
  });
  it("falls back from unsupported preferences to the configured language then English", () => {
    expect(incidentNotificationLanguage("de", "es").languageCode).toBe("es");
    expect(incidentNotificationLanguage(null, "es").languageCode).toBe("es");
    expect(incidentNotificationLanguage("de", "invalid").languageCode).toBe("en");
    expect(incidentNotificationLanguage("en", "es").languageCode).toBe("en");
  });
  it("keeps an empty previous status empty for new incidents", () => {
    expect(incidentNotificationLanguage("es").status("")).toBe("");
  });
});
