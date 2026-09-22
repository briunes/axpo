const findManyMock = jest.fn();
const userMock = jest.fn();
const simulationMock = jest.fn();
const rpcMock = jest.fn();
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  simulationIssue: { findMany: (...args: unknown[]) => findManyMock(...args) },
  user: { findFirst: (...args: unknown[]) => userMock(...args) },
  simulation: { findUnique: (...args: unknown[]) => simulationMock(...args) },
  $rpc: (...args: unknown[]) => rpcMock(...args),
} }));
jest.mock("@/infrastructure/database/databaseMode", () => ({ isSupabaseApiMode: () => true }));
import { parseIncidentArchive, SimulationIssueTransferService } from "../simulationIssueTransferService";

const date = "2026-09-22T12:00:00.000Z";
const person = { fullName: "Original Reporter", email: "reporter@example.com" };
const issue = {
  id: "incident-1", simulationId: "sim-1", simulationReference: "001/2026", description: "Problem details",
  status: "ESCALATED", appStatus: "IN_REVIEW", resolutionNotes: null,
  createdAt: date, updatedAt: date, statusChangedAt: date, reportedByUser: person, handledByUser: null,
  snapshot: { fileName: "snapshot.html", mimeType: "text/html", data: Buffer.from("<h1>Snapshot</h1>").toString("base64") },
  attachments: [{ fileName: "proof.pdf", mimeType: "application/pdf", data: Buffer.from("PDF data").toString("base64"), createdAt: date }],
  statusChanges: [{ fromStatus: "NEW", toStatus: "ESCALATED", fromAppStatus: null, toAppStatus: "NEW", notes: "Investigate", createdAt: date, changedByUser: person }],
};
const archive = { format: "axpo-simulation-incidents", version: 1, exportedAt: date, incidents: [issue] };

describe("Incident transfers", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    findManyMock.mockResolvedValue([]);
    userMock.mockResolvedValue({ id: "target-user" });
    simulationMock.mockResolvedValue({ id: "sim-1", referenceNumber: "001/2026" });
    rpcMock.mockResolvedValue(1);
  });
  it("previews counts and missing references without writing", async () => {
    userMock.mockResolvedValue(null); simulationMock.mockResolvedValue(null);
    const result = await SimulationIssueTransferService.import(archive, "sys-1", true);
    expect(result).toMatchObject({ toImport: 1, imported: 0, skipped: 0, missingUsers: [person.email], missingSimulations: ["001/2026"] });
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it("preserves bytes, timestamps and both workflows in one atomic database call", async () => {
    const result = await SimulationIssueTransferService.import(archive, "sys-1", false);
    expect(result.imported).toBe(1);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const record = rpcMock.mock.calls[0][1].payload[0];
    expect(record).toMatchObject({ id: issue.id, status: "ESCALATED", appStatus: "IN_REVIEW", createdAt: date, simulationId: "sim-1", reportedByUserId: "target-user" });
    expect(record.snapshotFileData).toBe("\\x" + Buffer.from(issue.snapshot.data, "base64").toString("hex"));
    expect(record.attachments[0].fileData).toBe("\\x" + Buffer.from("PDF data").toString("hex"));
    expect(record.statusChanges[0]).toMatchObject({ changedByUserId: "target-user", fromStatus: "NEW", toStatus: "ESCALATED", toAppStatus: "NEW", notes: "Investigate" });
    expect(record.statusChanges[1].notes).toContain("Original reporter:");
  });
  it("allocates a destination number while retaining the source number in history", async () => {
    await SimulationIssueTransferService.import({ ...archive, incidents: [{ ...issue, incidentNumber: 42 }] }, "sys-1", false);
    const record = rpcMock.mock.calls[0][1].payload[0];
    expect(record).not.toHaveProperty("incidentNumber");
    expect(record.statusChanges[1].notes).toContain("Original incident number: #42.");
  });
  it("accepts older archives without incident numbers", () => {
    expect(parseIncidentArchive(archive).incidents[0].incidentNumber).toBeUndefined();
  });
  it("preserves source attribution when users and simulations are absent", async () => {
    userMock.mockResolvedValue(null); simulationMock.mockResolvedValue(null);
    await SimulationIssueTransferService.import(archive, "sys-1", false);
    const record = rpcMock.mock.calls[0][1].payload[0];
    expect(record.reportedByUserId).toBe("sys-1");
    expect(record.simulationId).toBeNull();
    expect(record.simulationReference).toBe("001/2026");
    expect(record.statusChanges[0].notes).toContain("Original author: Original Reporter <reporter@example.com>");
  });
  it("does not link a mismatched simulation even when its ID matches", async () => {
    simulationMock.mockResolvedValue({ id: "sim-1", referenceNumber: "999/2026" });
    await SimulationIssueTransferService.import(archive, "sys-1", false);
    expect(rpcMock.mock.calls[0][1].payload[0].simulationId).toBeNull();
  });
  it("skips existing IDs without overwriting or duplicating files", async () => {
    findManyMock.mockResolvedValue([{ id: issue.id }]);
    expect(await SimulationIssueTransferService.import(archive, "sys-1", false)).toMatchObject({ imported: 0, skipped: 1 });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(userMock).not.toHaveBeenCalled();
  });
  it("reports a duplicate inserted concurrently as skipped", async () => {
    rpcMock.mockResolvedValue(0);
    expect(await SimulationIssueTransferService.import(archive, "sys-1", false)).toMatchObject({ imported: 0, skipped: 1 });
  });
  it.each([
    { ...archive, version: 99 },
    { ...archive, incidents: [issue, issue] },
    { ...archive, incidents: [{ ...issue, appStatus: null }] },
    { ...archive, incidents: [{ ...issue, snapshot: { ...issue.snapshot, data: "not base64!!" } }] },
  ])("rejects malformed or incompatible archives before any database operation", async (input) => {
    await expect(SimulationIssueTransferService.import(input, "sys-1", false)).rejects.toThrow();
    expect(findManyMock).not.toHaveBeenCalled(); expect(rpcMock).not.toHaveBeenCalled();
  });
  it("propagates database failure without attempting separate child writes", async () => {
    rpcMock.mockRejectedValue(new Error("Transaction rolled back"));
    await expect(SimulationIssueTransferService.import(archive, "sys-1", false)).rejects.toThrow("Transaction rolled back");
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
  it("exports a round-trip-compatible archive and excludes unrelated user data", async () => {
    findManyMock.mockResolvedValueOnce([{ id: issue.id, snapshotFileSize: 17, attachments: [{ fileSize: 8 }] }]).mockResolvedValueOnce([{
      ...issue, incidentNumber: 42, snapshotFileName: issue.snapshot.fileName, snapshotMimeType: issue.snapshot.mimeType, snapshotFileData: Buffer.from(issue.snapshot.data, "base64"),
      attachments: [{ ...issue.attachments[0], fileData: Buffer.from("PDF data") }],
    }]);
    const exported = JSON.parse(await SimulationIssueTransferService.export({ status: "ESCALATED" }));
    expect(parseIncidentArchive(exported).incidents[0]).toEqual({ ...issue, incidentNumber: 42 });
    expect(findManyMock.mock.calls[0][0].where).toEqual({ status: "ESCALATED" });
    expect(findManyMock.mock.calls[1][0].include.reportedByUser.select).toEqual({ fullName: true, email: true });
  });
  it("exports and imports an incident with an attachment larger than the former 4 MB cap", async () => {
    const attachment = Buffer.alloc(5 * 1024 * 1024, 65);
    findManyMock.mockResolvedValueOnce([{ id: issue.id, snapshotFileSize: 17, attachments: [{ fileSize: attachment.length }] }]).mockResolvedValueOnce([{
      ...issue, incidentNumber: 42, snapshotFileName: issue.snapshot.fileName, snapshotMimeType: issue.snapshot.mimeType, snapshotFileData: Buffer.from(issue.snapshot.data, "base64"),
      attachments: [{ ...issue.attachments[0], fileData: attachment }],
    }]);
    const json = await SimulationIssueTransferService.export({ id: { in: [issue.id] } });
    expect(Buffer.byteLength(json)).toBeGreaterThan(4 * 1024 * 1024);
    findManyMock.mockResolvedValue([]);
    expect(await SimulationIssueTransferService.import(JSON.parse(json), "sys-1", false)).toMatchObject({ imported: 1 });
    const restored = rpcMock.mock.calls[0][1].payload[0].attachments[0];
    expect(restored.fileSize).toBe(attachment.length);
    expect(Buffer.from(restored.fileData.slice(2), "hex").equals(attachment)).toBe(true);
  });
  it("refuses oversized exports before loading file data", async () => {
    findManyMock.mockResolvedValue([{ id: issue.id, snapshotFileSize: 101 * 1024 * 1024, attachments: [] }]);
    await expect(SimulationIssueTransferService.export({})).rejects.toThrow("too large");
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});
