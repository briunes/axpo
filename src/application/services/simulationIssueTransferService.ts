import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";
import { ValidationError } from "@/domain/errors/errors";

import { MAX_ISSUE_TRANSFER_BYTES } from "@/lib/simulationIssueTransferLimits";
export { MAX_ISSUE_TRANSFER_BYTES } from "@/lib/simulationIssueTransferLimits";
const status = z.enum(["NEW", "IN_REVIEW", "ESCALATED", "RESOLVED", "DISMISSED"]);
const appStatus = z.enum(["NEW", "IN_REVIEW", "RESOLVED", "DISMISSED"]).nullable();
const timestamp = z.string().datetime({ offset: true });
const identity = z.object({ fullName: z.string().max(500), email: z.string().email().max(320) });
const file = z.object({
  fileName: z.string().min(1).max(500), mimeType: z.string().min(1).max(200),
  // Avoid a repeated-group regex: large base64 strings can exhaust the regex stack.
  data: z.string().refine((value) => value.length % 4 === 0 && !/[^A-Za-z0-9+/]/.test(value.replace(/={1,2}$/, "")), "Invalid base64 file data"),
});
const incident = z.object({
  id: z.string().min(1).max(200), simulationId: z.string().max(200).nullable(), simulationReference: z.string().max(500).nullable(),
  description: z.string().max(100000), status, appStatus, resolutionNotes: z.string().max(100000).nullable(),
  createdAt: timestamp, updatedAt: timestamp, statusChangedAt: timestamp.nullable(),
  reportedByUser: identity, handledByUser: identity.nullable(), snapshot: file,
  attachments: z.array(file.extend({ createdAt: timestamp })).max(100),
  statusChanges: z.array(z.object({ fromStatus: status, toStatus: status, fromAppStatus: appStatus, toAppStatus: appStatus,
    notes: z.string().max(100000).nullable(), createdAt: timestamp, changedByUser: identity })).max(2000),
}).superRefine((item, ctx) => {
  if ((item.status === "ESCALATED") !== (item.appStatus !== null)) ctx.addIssue({ code: "custom", message: "Escalated incidents require an app administrator status" });
});
const archive = z.object({ format: z.literal("axpo-simulation-incidents"), version: z.literal(1), exportedAt: timestamp, incidents: z.array(incident).min(1).max(100) });
type Archive = z.infer<typeof archive>;

export function parseIncidentArchive(input: unknown): Archive {
  const result = archive.safeParse(input);
  if (!result.success) throw new ValidationError("Invalid incident export file or unsupported version", { issues: result.error.issues });
  const ids = result.data.incidents.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new ValidationError("The archive contains duplicate incident IDs");
  return result.data;
}

export class SimulationIssueTransferService {
  static async export(where: Prisma.SimulationIssueWhereInput) {
    // Inspect sizes before fetching binary payloads into memory.
    const sizes = await prisma.simulationIssue.findMany({ where, take: 101, select: { id: true, snapshotFileSize: true, attachments: { select: { fileSize: true } } } });
    if (!sizes.length) throw new ValidationError("No selected incidents were found");
    if (sizes.length > 100 || sizes.reduce((total, item) => total + item.snapshotFileSize + item.attachments.reduce((sum, attachment) => sum + attachment.fileSize, 0), 0) * 4 / 3 > MAX_ISSUE_TRANSFER_BYTES) {
      throw new ValidationError("Export is too large (maximum 100 incidents / 100 MB). Select fewer incidents and export smaller batches.");
    }
    const items = await prisma.simulationIssue.findMany({ where: { id: { in: sizes.map((item) => item.id) } }, orderBy: { createdAt: "asc" }, include: {
      reportedByUser: { select: { fullName: true, email: true } }, handledByUser: { select: { fullName: true, email: true } }, attachments: true,
      statusChanges: { orderBy: { createdAt: "asc" }, include: { changedByUser: { select: { fullName: true, email: true } } } },
    } });
    const data = { format: "axpo-simulation-incidents", version: 1, exportedAt: new Date().toISOString(), incidents: items.map((item) => ({
      id: item.id, simulationId: item.simulationId, simulationReference: item.simulationReference, description: item.description,
      status: item.status, appStatus: item.appStatus, resolutionNotes: item.resolutionNotes, createdAt: item.createdAt, updatedAt: item.updatedAt, statusChangedAt: item.statusChangedAt,
      reportedByUser: item.reportedByUser, handledByUser: item.handledByUser,
      snapshot: { fileName: item.snapshotFileName, mimeType: item.snapshotMimeType, data: Buffer.from(item.snapshotFileData).toString("base64") },
      attachments: item.attachments.map((attachment) => ({ fileName: attachment.fileName, mimeType: attachment.mimeType, data: Buffer.from(attachment.fileData).toString("base64"), createdAt: attachment.createdAt })),
      statusChanges: item.statusChanges.map((change) => ({ fromStatus: change.fromStatus, toStatus: change.toStatus, fromAppStatus: change.fromAppStatus, toAppStatus: change.toAppStatus, notes: change.notes, createdAt: change.createdAt, changedByUser: change.changedByUser })),
    })) };
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > MAX_ISSUE_TRANSFER_BYTES) throw new ValidationError("Export exceeds 100 MB. Select fewer incidents and export smaller batches.");
    return json;
  }

  static async import(input: unknown, importingUserId: string, preview: boolean) {
    const data = parseIncidentArchive(input);
    const existing = await prisma.simulationIssue.findMany({ where: { id: { in: data.incidents.map((item) => item.id) } }, select: { id: true } });
    const existingIds = new Set(existing.map((item) => item.id));
    const userIds = new Map<string, string | null>();
    const missingUsers = new Set<string>();
    const missingSimulations: string[] = [];
    const mapUser = async (person: z.infer<typeof identity>) => {
      const email = person.email.toLowerCase();
      if (!userIds.has(email)) {
        const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, isDeleted: false }, select: { id: true } });
        userIds.set(email, user?.id ?? null);
      }
      if (!userIds.get(email)) missingUsers.add(person.email);
      return userIds.get(email) ?? null;
    };
    const records = [];
    for (const item of data.incidents) {
      if (existingIds.has(item.id)) continue;
      const reporterId = await mapUser(item.reportedByUser);
      const handlerId = item.handledByUser ? await mapUser(item.handledByUser) : null;
      const simulation = item.simulationId ? await prisma.simulation.findUnique({ where: { id: item.simulationId }, select: { id: true, referenceNumber: true } }) : null;
      const simulationId = simulation && simulation.referenceNumber === item.simulationReference ? simulation.id : null;
      if (item.simulationId && !simulationId) missingSimulations.push(item.simulationReference ?? item.simulationId);
      const history = [];
      for (const change of item.statusChanges) {
        const authorId = await mapUser(change.changedByUser);
        history.push({ ...change, changedByUser: undefined, id: randomUUID(), changedByUserId: authorId ?? importingUserId,
          notes: authorId ? change.notes : `[Original author: ${change.changedByUser.fullName} <${change.changedByUser.email}>]\n${change.notes ?? ""}` });
      }
      history.push({ id: randomUUID(), fromStatus: item.status, toStatus: item.status, fromAppStatus: item.appStatus, toAppStatus: item.appStatus,
        changedByUserId: importingUserId, createdAt: new Date().toISOString(),
        notes: `Imported from an incident export dated ${data.exportedAt}. Original reporter: ${item.reportedByUser.fullName} <${item.reportedByUser.email}>.${item.handledByUser ? ` Original handler: ${item.handledByUser.fullName} <${item.handledByUser.email}>.` : ""}${!reporterId ? " Reporter is not present in this environment; linked to the importing sys admin." : ""}${item.simulationId && !simulationId ? ` Original simulation ${item.simulationId} is not linked in this environment; the snapshot is preserved.` : ""}` });
      const snapshotData = Buffer.from(item.snapshot.data, "base64");
      records.push({ id: item.id, simulationId, simulationReference: item.simulationReference, description: item.description, status: item.status, appStatus: item.appStatus,
        resolutionNotes: item.resolutionNotes, createdAt: item.createdAt, updatedAt: item.updatedAt, statusChangedAt: item.statusChangedAt,
        reportedByUserId: reporterId ?? importingUserId, handledByUserId: handlerId,
        snapshotFileName: item.snapshot.fileName, snapshotMimeType: item.snapshot.mimeType, snapshotFileSize: snapshotData.length, snapshotFileData: `\\x${snapshotData.toString("hex")}`,
        attachments: item.attachments.map((attachment) => { const bytes = Buffer.from(attachment.data, "base64"); return { id: randomUUID(), fileName: attachment.fileName, mimeType: attachment.mimeType, fileSize: bytes.length, fileData: `\\x${bytes.toString("hex")}`, createdAt: attachment.createdAt }; }),
        statusChanges: history,
      });
    }
    let imported = 0;
    if (!preview && records.length) {
      // A single database function keeps parent, files, and history atomic in
      // both direct Prisma and the Supabase API adapter (which has no transactions).
      if (isSupabaseApiMode()) {
        imported = await (prisma as unknown as { $rpc: (name: string, args: unknown) => Promise<number> }).$rpc("axpo_import_simulation_issues", { payload: records });
      } else {
        const result = await prisma.$queryRaw<Array<{ imported: number }>>`SELECT public.axpo_import_simulation_issues(${JSON.stringify(records)}::jsonb) AS imported`;
        imported = result[0].imported;
      }
    }
    return { total: data.incidents.length, toImport: records.length, imported, skipped: preview ? existing.length : data.incidents.length - imported, missingUsers: [...missingUsers], missingSimulations };
  }
}
