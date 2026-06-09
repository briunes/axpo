import { createSupabaseApiPrismaClient } from "../database/supabaseApiClient";
import { getDatabaseConnectionMode } from "../database/databaseMode";
import { Prisma } from "@prisma/client";

describe("Supabase Data API database adapter", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_DB_SCHEMA = "public";
    global.fetch = fetchMock;
  });

  it("selects API mode through the environment", () => {
    process.env.DB_CONNECTION_MODE = "api";
    expect(getDatabaseConnectionMode()).toBe("api");
  });

  it("queries a mapped table through PostgREST with server credentials", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: "user-1", email: "a@example.com" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createSupabaseApiPrismaClient();

    const user = await client.user.findUnique({
      where: { email: "a@example.com" },
      select: { id: true, email: true },
    });

    expect(user).toEqual({ id: "user-1", email: "a@example.com" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/users?");
    expect(url).toContain("email=eq.a%40example.com");
    expect(new Headers(init.headers).get("apikey")).toBe("sb_secret_test");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer sb_secret_test",
    );
  });

  it("rejects publishable keys before sending a database request", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_publishable_test";
    const client = createSupabaseApiPrismaClient();

    await expect(client.user.findMany()).rejects.toThrow(
      "requires an sb_secret_ key",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects legacy anon JWTs before sending a database request", async () => {
    const payload = Buffer.from(
      JSON.stringify({ role: "anon" }),
    ).toString("base64url");
    process.env.SUPABASE_SECRET_KEY = `eyJ.${payload}.signature`;
    const client = createSupabaseApiPrismaClient();

    await expect(client.user.findMany()).rejects.toThrow(
      "not service_role",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the connection-test RPC for $connect", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = createSupabaseApiPrismaClient();

    await client.$connect();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://project.supabase.co/rest/v1/rpc/axpo_test_api_connection",
    );
  });

  it("flattens Prisma compound unique selectors for PostgREST", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "permission-1",
            role: "AGENT",
            permissionKey: "section.simulations",
          },
        ]),
        { status: 200 },
      ),
    );
    const client = createSupabaseApiPrismaClient();

    await client.rolePermission.findUnique({
      where: {
        role_permissionKey: {
          role: "AGENT",
          permissionKey: "section.simulations",
        },
      },
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("role=eq.AGENT");
    expect(url).toContain("permissionKey=eq.section.simulations");
    expect(url).not.toContain("role_permissionKey");
  });

  it("creates supported nested child records through related API tables", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "template-1", name: "Welcome" }]), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "translation-1",
              emailTemplateId: "template-1",
              languageCode: "en",
            },
            {
              id: "translation-2",
              emailTemplateId: "template-1",
              languageCode: "pt",
            },
          ]),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "template-1",
              name: "Welcome",
              translations: [{ languageCode: "en" }],
            },
          ]),
          { status: 200 },
        ),
      );
    const client = createSupabaseApiPrismaClient();

    await client.emailTemplate.create({
      data: {
        name: "Welcome",
        translations: {
          create: [
            { languageCode: "en", subject: "Hello", htmlContent: "Hi" },
            { languageCode: "pt", subject: "Ola", htmlContent: "Ola" },
          ],
        },
      },
      include: { translations: true },
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/email_templates?");
    expect(fetchMock.mock.calls[1][0]).toContain(
      "/rest/v1/email_template_translations",
    );
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/rest/v1/email_template_translations"),
      ),
    ).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual([
      expect.objectContaining({
        emailTemplateId: "template-1",
        languageCode: "en",
      }),
      expect.objectContaining({
        emailTemplateId: "template-1",
        languageCode: "pt",
      }),
    ]);
  });

  it("creates OCR log files through the nested relation", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "ocr-1", status: "SUCCESS" }]), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "file-1", ocrLogId: "ocr-1" }]),
          { status: 201 },
        ),
      );
    const client = createSupabaseApiPrismaClient();

    await client.ocrLog.create({
      data: {
        provider: "openai",
        model: "gpt-test",
        status: "SUCCESS",
        ocrFiles: {
          create: {
            fileName: "invoice.pdf",
            fileSizeBytes: 3,
            fileData: Buffer.from("pdf"),
          },
        },
      },
    });

    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1/ocr_log_files");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual([
      expect.objectContaining({
        ocrLogId: "ocr-1",
        fileName: "invoice.pdf",
        fileData: "\\x706466",
      }),
    ]);
  });

  it("derives relation foreign keys for Prisma connect writes", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([{ id: "ocr-1", simulationId: "simulation-1" }]),
        { status: 200 },
      ),
    );
    const client = createSupabaseApiPrismaClient();

    await client.ocrLog.update({
      where: { id: "ocr-1" },
      data: { simulation: { connect: { id: "simulation-1" } } },
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      simulationId: "simulation-1",
    });
  });

  it("serializes Prisma Decimal values as numeric strings", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: "invoice-1", totalCost: "1.25" }]), {
        status: 201,
      }),
    );
    const client = createSupabaseApiPrismaClient();

    await client.ocrUsageInvoice.create({
      data: {
        label: "June",
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
        periodEnd: new Date("2026-06-30T23:59:59.999Z"),
        baseCost: new Prisma.Decimal("1.25"),
        markupCost: new Prisma.Decimal("0.10"),
        fixedFeeCost: new Prisma.Decimal("0"),
        totalCost: new Prisma.Decimal("1.35"),
      },
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        baseCost: "1.25",
        markupCost: "0.1",
        fixedFeeCost: "0",
        totalCost: "1.35",
      }),
    );
  });

  it("hydrates Prisma Decimal and BigInt fields from PostgREST", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "invoice-1",
            totalTokens: "1465100",
            baseCost: "1.25",
            totalCost: "1.35",
          },
        ]),
        { status: 200 },
      ),
    );
    const client = createSupabaseApiPrismaClient();

    const invoice = await client.ocrUsageInvoice.findUnique({
      where: { id: "invoice-1" },
      select: {
        id: true,
        totalTokens: true,
        baseCost: true,
        totalCost: true,
      },
    });

    expect(invoice.totalTokens).toBe(BigInt("1465100"));
    expect(invoice.baseCost).toBeInstanceOf(Prisma.Decimal);
    expect(invoice.baseCost.toNumber()).toBe(1.25);
    expect(invoice.totalCost.toNumber()).toBe(1.35);
  });

  it("attaches relation counts after a nested create", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "set-1", name: "Prices" }]), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "item-1", baseValueSetId: "set-1" }]),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "set-1", name: "Prices" }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "content-range": "0-0/1" },
        }),
      );
    const client = createSupabaseApiPrismaClient();

    const set = await client.baseValueSet.create({
      data: {
        name: "Prices",
        items: { create: [{ key: "energy", valueNumeric: 10 }] },
      },
      include: { _count: { select: { items: true } } },
    });

    expect(set._count).toEqual({ items: 1 });
    expect(decodeURIComponent(fetchMock.mock.calls[3][0])).toContain(
      "baseValueSetId=eq.set-1",
    );
  });

  it("attaches relation counts after an update", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "set-1", name: "Prices" }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "content-range": "0-0/2" },
        }),
      );
    const client = createSupabaseApiPrismaClient();

    const set = await client.baseValueSet.update({
      where: { id: "set-1" },
      data: { name: "Prices" },
      include: { _count: { select: { items: true } } },
    });

    expect(set._count).toEqual({ items: 2 });
    expect(decodeURIComponent(fetchMock.mock.calls[1][0])).toContain(
      "baseValueSetId=eq.set-1",
    );
  });

  it("keeps scalar fields when Prisma include adds a relation", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "template-1",
            active: true,
            subject: "Code",
            translations: [{ languageCode: "en" }],
          },
        ]),
        { status: 200 },
      ),
    );
    const client = createSupabaseApiPrismaClient();

    const template = await client.emailTemplate.findUnique({
      where: { id: "template-1" },
      include: { translations: true },
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(decodeURIComponent(url)).toContain(
      "select=*,translations:email_template_translations(*)",
    );
    expect(template).toEqual(
      expect.objectContaining({ id: "template-1", active: true }),
    );
  });

  it("hydrates Prisma DateTime fields from PostgREST strings", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "audit-1",
            createdAt: "2026-06-08T12:34:56.000",
            actor: {
              id: "user-1",
              createdAt: "2026-06-01T10:00:00.000",
            },
          },
        ]),
        { status: 200 },
      ),
    );
    const client = createSupabaseApiPrismaClient();

    const log = await client.auditLog.findFirst({
      include: { actor: true },
    });

    expect(log.createdAt).toBeInstanceOf(Date);
    expect(log.createdAt.toISOString()).toBe("2026-06-08T12:34:56.000Z");
    expect(log.actor.createdAt).toBeInstanceOf(Date);
  });

  it("uses exact PostgREST counts without truncating large relations", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "agency-1", name: "One" },
            { id: "agency-2", name: "Two" },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "content-range": "0-0/3987" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "content-range": "0-0/3733" },
        }),
      );
    const client = createSupabaseApiPrismaClient();

    const agencies = await client.agency.findMany({
      include: {
        _count: { select: { users: true } },
        users: { select: { id: true } },
      },
    });

    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).not.toContain(
      "_count",
    );
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toContain(
      "users:users!users_agencyId_fkey",
    );
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).not.toContain(
      "users.role",
    );
    expect(fetchMock.mock.calls[1][1].method).toBe("HEAD");
    expect(fetchMock.mock.calls[2][1].method).toBe("HEAD");
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get("Prefer")).toBe(
      "count=exact",
    );
    expect(decodeURIComponent(fetchMock.mock.calls[1][0])).toContain(
      "agencyId=eq.agency-1",
    );
    expect(decodeURIComponent(fetchMock.mock.calls[2][0])).toContain(
      "agencyId=eq.agency-2",
    );
    expect(agencies).toEqual([
      expect.objectContaining({ _count: { users: 3987 } }),
      expect.objectContaining({ _count: { users: 3733 } }),
    ]);
  });

  it("applies filters and ordering to embedded Prisma relations", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: "agency-1", users: [] }]), {
        status: 200,
      }),
    );
    const client = createSupabaseApiPrismaClient();

    await client.agency.findMany({
      include: {
        users: {
          where: { role: "COMMERCIAL" },
          orderBy: { fullName: "asc" },
          take: 5,
        },
      },
    });

    const url = decodeURIComponent(fetchMock.mock.calls[0][0] as string);
    expect(url).toContain("users.role=eq.COMMERCIAL");
    expect(url).toContain("users.order=fullName.asc");
    expect(url).toContain("users.limit=5");
  });

  it("hydrates user self-relations with batched manual joins", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "user-2",
              fullName: "Commercial",
              createdByUserId: "user-1",
              updatedByUserId: "user-1",
            },
          ]),
          { status: 200 },
        ),
      )
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([{ id: "user-1", fullName: "Administrator" }]),
            { status: 200 },
          ),
        ),
      );
    const client = createSupabaseApiPrismaClient();

    const users = await client.user.findMany({
      select: {
        id: true,
        fullName: true,
        createdByUser: { select: { id: true, fullName: true } },
        updatedByUser: { select: { id: true, fullName: true } },
      },
    });

    const firstUrl = decodeURIComponent(fetchMock.mock.calls[0][0] as string);
    expect(firstUrl).toContain("createdByUserId");
    expect(firstUrl).toContain("updatedByUserId");
    expect(firstUrl).not.toContain("createdByUser:users");
    expect(users).toEqual([
      {
        id: "user-2",
        fullName: "Commercial",
        createdByUser: { id: "user-1", fullName: "Administrator" },
        updatedByUser: { id: "user-1", fullName: "Administrator" },
      },
    ]);
  });

  it("fails explicitly for Prisma transactions instead of falling back", async () => {
    const client = createSupabaseApiPrismaClient();

    await expect(client.$transaction([])).rejects.toThrow(
      "cannot emulate Prisma transactions",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
