import crypto from "crypto";
import { Prisma } from "@prisma/client";

type JsonRecord = Record<string, any>;

interface RelationMeta {
  table: string;
  constraint?: string;
  many?: boolean;
  localField?: string;
  foreignField?: string;
  manual?: boolean;
}

interface ModelMeta {
  table: string;
  timestamps?: boolean;
  relations?: Record<string, RelationMeta>;
  compoundUniques?: Record<string, string[]>;
}

const models: Record<string, ModelMeta> = {
  agency: {
    table: "agencies",
    timestamps: true,
    relations: {
      users: {
        table: "users",
        constraint: "users_agencyId_fkey",
        many: true,
      },
      clients: { table: "clients", many: true },
      simulations: { table: "simulations", many: true },
      agencyTariffs: { table: "agency_tariffs", many: true },
      agencyProductConfigs: {
        table: "agency_product_configs",
        many: true,
      },
      createdByUser: {
        table: "users",
        constraint: "agencies_createdByUserId_fkey",
      },
      updatedByUser: {
        table: "users",
        constraint: "agencies_updatedByUserId_fkey",
      },
    },
  },
  agencyTariff: {
    table: "agency_tariffs",
    timestamps: true,
    relations: {
      agency: { table: "agencies", localField: "agencyId" },
    },
    compoundUniques: {
      agencyId_tariffType: ["agencyId", "tariffType"],
    },
  },
  agencyProductConfig: {
    table: "agency_product_configs",
    timestamps: true,
    relations: {
      agency: { table: "agencies", localField: "agencyId" },
    },
    compoundUniques: {
      agencyId_productKey: ["agencyId", "productKey"],
      agencyId_commodity_pricingType_productKey: [
        "agencyId",
        "commodity",
        "pricingType",
        "productKey",
      ],
    },
  },
  client: {
    table: "clients",
    timestamps: true,
    relations: {
      agency: { table: "agencies" },
      simulations: { table: "simulations", many: true },
      createdByUser: {
        table: "users",
        constraint: "clients_createdByUserId_fkey",
      },
      updatedByUser: {
        table: "users",
        constraint: "clients_updatedByUserId_fkey",
      },
    },
  },
  user: {
    table: "users",
    timestamps: true,
    relations: {
      agency: {
        table: "agencies",
        constraint: "users_agencyId_fkey",
      },
      sessions: { table: "user_sessions", many: true },
      preferences: { table: "user_preferences" },
      simulations: { table: "simulations", many: true },
      createdByUser: {
        table: "users",
        localField: "createdByUserId",
        manual: true,
      },
      updatedByUser: {
        table: "users",
        localField: "updatedByUserId",
        manual: true,
      },
    },
  },
  userSession: {
    table: "user_sessions",
    timestamps: true,
    relations: {
      user: { table: "users", constraint: "user_sessions_userId_fkey" },
      terminatedByUser: {
        table: "users",
        constraint: "user_sessions_terminatedByUserId_fkey",
      },
    },
  },
  userPreferences: {
    table: "user_preferences",
    timestamps: true,
    relations: { user: { table: "users" } },
  },
  simulation: {
    table: "simulations",
    timestamps: true,
    relations: {
      agency: { table: "agencies" },
      ownerUser: {
        table: "users",
        constraint: "simulations_ownerUserId_fkey",
      },
      client: { table: "clients" },
      versions: { table: "simulation_versions", many: true },
      accessAttempts: { table: "access_attempts", many: true },
      ocrLogs: { table: "ocr_logs", many: true },
    },
  },
  simulationVersion: {
    table: "simulation_versions",
    relations: {
      simulation: { table: "simulations" },
      baseValueSet: { table: "base_value_sets" },
      createdByUser: {
        table: "users",
        constraint: "simulation_versions_createdBy_fkey",
      },
    },
  },
  baseValueSet: {
    table: "base_value_sets",
    timestamps: true,
    relations: {
      agency: { table: "agencies" },
      items: {
        table: "base_value_items",
        many: true,
        foreignField: "baseValueSetId",
      },
      createdByUser: {
        table: "users",
        constraint: "base_value_sets_createdBy_fkey",
      },
    },
  },
  baseValueItem: {
    table: "base_value_items",
    timestamps: true,
    relations: { baseValueSet: { table: "base_value_sets" } },
    compoundUniques: {
      baseValueSetId_key: ["baseValueSetId", "key"],
    },
  },
  excelParserProductConfig: {
    table: "excel_parser_product_configs",
    timestamps: true,
    compoundUniques: {
      scopeType_sourceLabel: ["scopeType", "sourceLabel"],
    },
  },
  accessAttempt: {
    table: "access_attempts",
    relations: { simulation: { table: "simulations" } },
  },
  auditLog: {
    table: "audit_logs",
    relations: { actor: { table: "users" } },
  },
  systemConfig: { table: "system_config", timestamps: true },
  pdfTemplate: {
    table: "pdf_templates",
    timestamps: true,
    relations: {
      translations: {
        table: "pdf_template_translations",
        many: true,
        foreignField: "pdfTemplateId",
      },
    },
  },
  pdfTemplateTranslation: {
    table: "pdf_template_translations",
    timestamps: true,
    relations: {
      pdfTemplate: { table: "pdf_templates", localField: "pdfTemplateId" },
    },
    compoundUniques: {
      pdfTemplateId_languageCode: ["pdfTemplateId", "languageCode"],
    },
  },
  emailTemplate: {
    table: "email_templates",
    timestamps: true,
    relations: {
      translations: {
        table: "email_template_translations",
        many: true,
        foreignField: "emailTemplateId",
      },
    },
  },
  emailTemplateTranslation: {
    table: "email_template_translations",
    timestamps: true,
    relations: {
      emailTemplate: {
        table: "email_templates",
        localField: "emailTemplateId",
      },
    },
    compoundUniques: {
      emailTemplateId_languageCode: ["emailTemplateId", "languageCode"],
    },
  },
  rolePermission: {
    table: "role_permissions",
    timestamps: true,
    compoundUniques: { role_permissionKey: ["role", "permissionKey"] },
  },
  templateVariable: { table: "template_variables", timestamps: true },
  emailLog: {
    table: "email_logs",
    relations: { triggeredByUser: { table: "users" } },
  },
  cronLog: { table: "cron_logs" },
  invoiceProviderPrompt: {
    table: "invoice_provider_prompts",
    timestamps: true,
  },
  ocrLog: {
    table: "ocr_logs",
    relations: {
      user: { table: "users" },
      simulation: {
        table: "simulations",
        localField: "simulationId",
      },
      ocrFiles: {
        table: "ocr_log_files",
        many: true,
        foreignField: "ocrLogId",
      },
    },
  },
  ocrLogFile: {
    table: "ocr_log_files",
    relations: { ocrLog: { table: "ocr_logs" } },
  },
  appErrorLog: {
    table: "app_error_logs",
    relations: { user: { table: "users" } },
  },
  ocrModelPrice: { table: "ocr_model_prices", timestamps: true },
  ocrUsageInvoice: {
    table: "ocr_usage_invoices",
    timestamps: true,
    relations: {
      agency: {
        table: "agencies",
        constraint: "ocr_usage_invoices_agencyId_fkey",
      },
      client: {
        table: "clients",
        constraint: "ocr_usage_invoices_clientId_fkey",
      },
      user: { table: "users", constraint: "ocr_usage_invoices_userId_fkey" },
      createdByUser: {
        table: "users",
        constraint: "ocr_usage_invoices_createdByUserId_fkey",
      },
    },
  },
};

const prismaModels = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);

const prismaModelName = (modelName: string): string =>
  `${modelName.charAt(0).toUpperCase()}${modelName.slice(1)}`;

const adapterModelName = (modelName: string): string =>
  `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`;

const assertServerApiKey = (key: string): void => {
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SECRET_KEY contains a publishable key. API database mode requires an sb_secret_ key or a legacy service_role JWT.",
    );
  }

  if (!key.startsWith("eyJ")) return;

  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1] || "", "base64url").toString("utf8"),
    ) as { role?: string };
    if (payload.role !== "service_role") {
      throw new Error(
        `legacy JWT role is ${payload.role || "missing"}, not service_role`,
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JWT";
    throw new Error(
      `SUPABASE_SECRET_KEY must be a legacy service_role JWT: ${detail}.`,
    );
  }
};

const getConfig = () => {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "API database mode requires SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  assertServerApiKey(key);
  return {
    restUrl: `${url}/rest/v1`,
    key,
    schema: process.env.SUPABASE_DB_SCHEMA || "public",
  };
};

const cuid = (): string =>
  `c${Date.now().toString(36)}${crypto.randomBytes(12).toString("hex")}`.slice(
    0,
    25,
  );

const serialize = (value: any): any => {
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return `\\x${Buffer.from(value).toString("hex")}`;
  }
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serialize(item)]),
    );
  }
  return value;
};

const deserialize = (value: any): any => {
  if (Array.isArray(value)) return value.map(deserialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deserialize(item)]),
    );
  }
  if (typeof value === "string" && value.startsWith("\\x")) {
    return Buffer.from(value.slice(2), "hex");
  }
  return value;
};

const parsePrismaDateTime = (value: string): Date => {
  // Prisma maps DateTime to PostgreSQL `timestamp without time zone` and
  // interprets those values as UTC. PostgREST returns them without a suffix,
  // which JavaScript would otherwise parse in the server's local timezone.
  const hasTimeZone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`);
};

const deserializeModel = (value: any, modelName: string): any => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => deserializeModel(item, modelName));
  }
  if (typeof value !== "object") return deserialize(value);

  const model = prismaModels.get(prismaModelName(modelName));
  if (!model) return deserialize(value);

  const fields = new Map(model.fields.map((field) => [field.name, field]));
  return Object.fromEntries(
    Object.entries(value).map(([fieldName, fieldValue]) => {
      const field = fields.get(fieldName);
      if (!field) return [fieldName, deserialize(fieldValue)];
      if (field.kind === "object") {
        return [
          fieldName,
          deserializeModel(fieldValue, adapterModelName(field.type)),
        ];
      }
      if (field.type === "DateTime" && typeof fieldValue === "string") {
        return [fieldName, parsePrismaDateTime(fieldValue)];
      }
      if (field.type === "Decimal" && fieldValue !== null) {
        return [fieldName, new Prisma.Decimal(fieldValue as string | number)];
      }
      if (field.type === "BigInt" && fieldValue !== null) {
        return [fieldName, BigInt(fieldValue as string | number)];
      }
      if (field.type === "Bytes" && typeof fieldValue === "string") {
        return [
          fieldName,
          fieldValue.startsWith("\\x")
            ? Buffer.from(fieldValue.slice(2), "hex")
            : Buffer.from(fieldValue, "base64"),
        ];
      }
      return [fieldName, deserialize(fieldValue)];
    }),
  );
};

const quoteFilterValue = (value: any): string => {
  const serialized = serialize(value);
  if (serialized === null) return "null";
  if (typeof serialized === "string") {
    return `"${serialized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return String(serialized);
};

const fieldFilter = (field: string, value: any): string[] => {
  if (value === null) return [`${field}=is.null`];
  if (
    typeof value !== "object" ||
    value instanceof Date ||
    Array.isArray(value)
  ) {
    return [`${field}=eq.${encodeURIComponent(String(serialize(value)))}`];
  }

  const filters: string[] = [];
  for (const [operator, operand] of Object.entries(value)) {
    if (operator === "equals") filters.push(...fieldFilter(field, operand));
    else if (operator === "not") {
      if (operand === null) filters.push(`${field}=not.is.null`);
      else
        filters.push(
          `${field}=not.eq.${encodeURIComponent(String(serialize(operand)))}`,
        );
    } else if (operator === "in" || operator === "notIn") {
      const values = (operand as any[]).map(quoteFilterValue).join(",");
      const prefix = operator === "notIn" ? "not.in" : "in";
      filters.push(`${field}=${prefix}.(${encodeURIComponent(values)})`);
    } else if (
      ["gt", "gte", "lt", "lte", "contains", "startsWith", "endsWith"].includes(
        operator,
      )
    ) {
      const mode =
        (value as JsonRecord).mode === "insensitive" ? "ilike" : "like";
      const mapped =
        operator === "contains" ||
        operator === "startsWith" ||
        operator === "endsWith"
          ? mode
          : operator;
      const raw = String(serialize(operand));
      const pattern =
        operator === "contains"
          ? `*${raw}*`
          : operator === "startsWith"
            ? `${raw}*`
            : operator === "endsWith"
              ? `*${raw}`
              : raw;
      filters.push(`${field}=${mapped}.${encodeURIComponent(pattern)}`);
    }
  }
  return filters;
};

const expression = (where: JsonRecord): string => {
  const parts: string[] = [];
  for (const [field, value] of Object.entries(where || {})) {
    if (field === "AND" || field === "OR") {
      const items = (Array.isArray(value) ? value : [value]).map(expression);
      parts.push(`${field.toLowerCase()}(${items.join(",")})`);
      continue;
    }
    if (field === "NOT") {
      parts.push(`not.and(${expression(value as JsonRecord)})`);
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !Object.keys(value).some((key) =>
        [
          "equals",
          "not",
          "in",
          "notIn",
          "gt",
          "gte",
          "lt",
          "lte",
          "contains",
          "startsWith",
          "endsWith",
          "mode",
        ].includes(key),
      )
    ) {
      for (const filter of whereToFilters(value as JsonRecord, `${field}.`)) {
        parts.push(filter.replace("=", "."));
      }
      continue;
    }
    for (const filter of fieldFilter(field, value)) {
      parts.push(filter.replace("=", "."));
    }
  }
  return parts.join(",");
};

const whereToFilters = (where: JsonRecord = {}, prefix = ""): string[] => {
  const filters: string[] = [];
  for (const [field, value] of Object.entries(where)) {
    if (field === "NOT") {
      const items = Array.isArray(value) ? value : [value];
      filters.push(
        `and=(not.and(${items.map((item) => expression(item as JsonRecord)).join(",")}))`,
      );
      continue;
    }
    if (field === "AND" || field === "OR") {
      filters.push(
        `${field.toLowerCase()}=(${expression({ [field]: value }).replace(/^(and|or)\(|\)$/g, "")})`,
      );
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !Object.keys(value).some((key) =>
        [
          "equals",
          "not",
          "in",
          "notIn",
          "gt",
          "gte",
          "lt",
          "lte",
          "contains",
          "startsWith",
          "endsWith",
          "mode",
        ].includes(key),
      )
    ) {
      filters.push(
        ...whereToFilters(value as JsonRecord, `${prefix}${field}.`),
      );
    } else {
      filters.push(...fieldFilter(`${prefix}${field}`, value));
    }
  }
  return filters;
};

const selection = (
  meta: ModelMeta,
  select?: JsonRecord,
  include?: JsonRecord,
): string => {
  // Prisma `include` adds relations to the model's scalar fields. PostgREST
  // requires those scalar fields to be selected explicitly alongside embeds.
  const entries: string[] = select === undefined ? ["*"] : [];
  const source = select ?? {};
  for (const [field, config] of Object.entries(source)) {
    if (!config) continue;
    if (field === "_count") continue;
    const relation = meta.relations?.[field];
    if (!relation) {
      entries.push(field);
      continue;
    }
    if (relation.manual) {
      if (relation.localField && !entries.includes(relation.localField)) {
        entries.push(relation.localField);
      }
      continue;
    }
    const nested =
      config === true
        ? "*"
        : selection(
            models[
              Object.keys(models).find(
                (name) => models[name].table === relation.table,
              )!
            ] ?? { table: relation.table },
            (config as JsonRecord).select,
            (config as JsonRecord).include,
          );
    entries.push(
      `${field}:${relation.table}${relation.constraint ? `!${relation.constraint}` : ""}(${nested || "*"})`,
    );
  }
  for (const [field, config] of Object.entries(include ?? {})) {
    if (!config) continue;
    if (field === "_count") continue;
    const relation = meta.relations?.[field];
    if (!relation) {
      throw new Error(
        `Supabase API relation metadata is missing for "${field}"`,
      );
    }
    if (relation.manual) {
      if (relation.localField && !entries.includes(relation.localField)) {
        entries.push(relation.localField);
      }
      continue;
    }
    const relationMeta = models[
      Object.keys(models).find((name) => models[name].table === relation.table)!
    ] ?? { table: relation.table };
    const nestedConfig = config === true ? {} : (config as JsonRecord);
    let nested = selection(
      relationMeta,
      nestedConfig.select,
      nestedConfig.include,
    );
    if (!nested) nested = "*";
    entries.push(
      `${field}:${relation.table}${relation.constraint ? `!${relation.constraint}` : ""}(${nested})`,
    );
  }
  return entries.length ? entries.join(",") : "*";
};

const relationQueryParams = (
  meta: ModelMeta,
  select?: JsonRecord,
  include?: JsonRecord,
): string[] => {
  const params: string[] = [];
  for (const source of [select ?? {}, include ?? {}]) {
    for (const [field, config] of Object.entries(source)) {
      if (
        field === "_count" ||
        !config ||
        config === true ||
        typeof config !== "object"
      ) {
        continue;
      }
      const relation = meta.relations?.[field];
      if (!relation || relation.manual) continue;
      const nested = config as JsonRecord;
      if (nested.where) {
        params.push(...whereToFilters(nested.where, `${field}.`));
      }
      const orderBy = nested.orderBy
        ? Array.isArray(nested.orderBy)
          ? nested.orderBy
          : [nested.orderBy]
        : [];
      const orderParts: string[] = [];
      for (const order of orderBy) {
        for (const [orderField, direction] of Object.entries(order)) {
          orderParts.push(`${orderField}.${direction}`);
        }
      }
      if (orderParts.length) {
        params.push(`${field}.order=${orderParts.join(",")}`);
      }
      if (nested.skip !== undefined)
        params.push(`${field}.offset=${nested.skip}`);
      if (nested.take !== undefined) {
        params.push(`${field}.limit=${Math.abs(nested.take)}`);
      }
    }
  }
  return params;
};

const POSTGREST_PAGE_SIZE = 1000;

class SupabaseApi {
  private async request(
    path: string,
    init: RequestInit = {},
    options: { single?: boolean; count?: boolean; modelName?: string } = {},
  ): Promise<any> {
    const { restUrl, key, schema } = getConfig();
    const headers = new Headers(init.headers);
    headers.set("apikey", key);
    headers.set("Authorization", `Bearer ${key}`);
    headers.set("Accept-Profile", schema);
    headers.set("Content-Profile", schema);
    if (init.body) headers.set("Content-Type", "application/json");
    if (options.count) headers.set("Prefer", "count=exact");
    else if (init.method && init.method !== "GET" && init.method !== "HEAD") {
      const existing = headers.get("Prefer");
      headers.set(
        "Prefer",
        existing
          ? `${existing},return=representation`
          : "return=representation",
      );
    }

    const response = await fetch(`${restUrl}/${path}`, { ...init, headers });
    if (!response.ok) {
      const detail = await response.text();
      const permissionHint =
        (response.status === 401 || response.status === 403) &&
        (detail.includes('"42501"') ||
          detail.includes("permission denied for schema"))
          ? " Use an sb_secret_ key (or legacy service_role JWT) and apply the pending Prisma migrations to grant service_role access to the configured schema."
          : "";
      const error = new Error(
        `Supabase Data API ${response.status} ${response.statusText}: ${detail}${permissionHint}`,
      );
      if (detail.includes("23505")) {
        Object.assign(error, { code: "P2002" });
      }
      throw error;
    }
    if (options.count) {
      const range = response.headers.get("content-range");
      return Number(range?.split("/")[1] ?? 0);
    }
    if (response.status === 204) return null;
    const json = await response.json();
    const data = options.modelName
      ? deserializeModel(json, options.modelName)
      : deserialize(json);
    if (options.single) return Array.isArray(data) ? (data[0] ?? null) : data;
    return data;
  }

  delegate(modelName: string): JsonRecord {
    const meta = models[modelName];
    if (!meta)
      throw new Error(`No Supabase API table mapping for ${modelName}`);

    const normalizeWhere = (where: JsonRecord = {}): JsonRecord => {
      const normalized: JsonRecord = {};
      for (const [field, value] of Object.entries(where)) {
        const compoundFields = meta.compoundUniques?.[field];
        if (
          compoundFields &&
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          for (const compoundField of compoundFields) {
            normalized[compoundField] = (value as JsonRecord)[compoundField];
          }
        } else {
          normalized[field] = value;
        }
      }
      return normalized;
    };

    const buildPath = (args: JsonRecord = {}, extra: string[] = []) => {
      const query = [
        `select=${encodeURIComponent(selection(meta, args.select, args.include))}`,
        ...whereToFilters(normalizeWhere(args.where)),
        ...relationQueryParams(meta, args.select, args.include),
        ...extra,
      ];
      const orderBy = args.orderBy
        ? Array.isArray(args.orderBy)
          ? args.orderBy
          : [args.orderBy]
        : [];
      const orderParts: string[] = [];
      for (const order of orderBy) {
        for (const [field, direction] of Object.entries(order)) {
          orderParts.push(`${field}.${direction}`);
        }
      }
      if (orderParts.length) query.push(`order=${orderParts.join(",")}`);
      if (args.skip !== undefined) query.push(`offset=${args.skip}`);
      if (args.take !== undefined) query.push(`limit=${Math.abs(args.take)}`);
      return `${meta.table}?${query.join("&")}`;
    };

    const relationForeignField = (
      relationField: string,
      relation: RelationMeta,
    ): string => {
      if (relation.foreignField) return relation.foreignField;
      const childModelName = Object.keys(models).find(
        (name) => models[name].table === relation.table,
      );
      const childModel = childModelName
        ? prismaModels.get(prismaModelName(childModelName))
        : undefined;
      const parentName = prismaModelName(modelName);
      const backRelation = childModel?.fields.find(
        (field) =>
          field.kind === "object" &&
          field.type === parentName &&
          Boolean(field.relationFromFields?.length),
      );
      const foreignField = backRelation?.relationFromFields?.[0];
      if (!foreignField) {
        throw new Error(
          `Supabase API count metadata is missing for "${modelName}.${relationField}"`,
        );
      }
      return foreignField;
    };

    const relationLocalField = (
      relationField: string,
      relation: RelationMeta,
    ): string => {
      if (relation.localField) return relation.localField;
      const model = prismaModels.get(prismaModelName(modelName));
      const relationFieldMeta = model?.fields.find(
        (field) => field.kind === "object" && field.name === relationField,
      );
      const localField = relationFieldMeta?.relationFromFields?.[0];
      if (!localField) {
        throw new Error(
          `Supabase API relation metadata is missing for "${modelName}.${relationField}"`,
        );
      }
      return localField;
    };

    const attachCounts = async (
      result: any,
      args: JsonRecord = {},
    ): Promise<any> => {
      const countConfig = args.select?._count ?? args.include?._count;
      if (!countConfig) return result;

      const rows = Array.isArray(result) ? result : result ? [result] : [];
      if (!rows.length) return result;
      const requested = countConfig === true ? {} : (countConfig.select ?? {});

      for (const [relationField, config] of Object.entries(requested)) {
        if (!config) continue;
        const relation = meta.relations?.[relationField];
        if (!relation?.many) {
          throw new Error(
            `Supabase API count relation metadata is missing for "${modelName}.${relationField}"`,
          );
        }
        const childModelName = Object.keys(models).find(
          (name) => models[name].table === relation.table,
        );
        if (!childModelName) {
          throw new Error(`No model mapping for count table ${relation.table}`);
        }
        const foreignField = relationForeignField(relationField, relation);
        const totals = await Promise.all(
          rows.map((row) =>
            this.delegate(childModelName).count({
              where: { [foreignField]: row.id },
            }),
          ),
        );
        rows.forEach((row, index) => {
          row._count ??= {};
          row._count[relationField] = totals[index] ?? 0;
        });
      }
      return result;
    };

    const attachManualRelations = async (
      result: any,
      args: JsonRecord = {},
    ): Promise<any> => {
      const rows = Array.isArray(result) ? result : result ? [result] : [];
      if (!rows.length) return result;

      for (const source of [args.select ?? {}, args.include ?? {}]) {
        for (const [relationField, config] of Object.entries(source)) {
          if (!config) continue;
          const relation = meta.relations?.[relationField];
          if (!relation?.manual || !relation.localField) continue;

          const relatedModelName = Object.keys(models).find(
            (name) => models[name].table === relation.table,
          );
          if (!relatedModelName) {
            throw new Error(
              `No model mapping for manual relation table ${relation.table}`,
            );
          }
          const ids = [
            ...new Set(
              rows
                .map((row) => row[relation.localField!])
                .filter((id): id is string => typeof id === "string"),
            ),
          ];
          const nestedConfig = config === true ? {} : (config as JsonRecord);
          const nestedSelect = nestedConfig.select
            ? { ...nestedConfig.select, id: true }
            : undefined;
          const relatedRows = ids.length
            ? await this.delegate(relatedModelName).findMany({
                where: { id: { in: ids } },
                select: nestedSelect,
                include: nestedConfig.include,
              })
            : [];
          const relatedById = new Map(
            relatedRows.map((related: JsonRecord) => [related.id, related]),
          );

          for (const row of rows) {
            const id = row[relation.localField];
            row[relationField] = id ? (relatedById.get(id) ?? null) : null;
            if (args.select && !args.select[relation.localField]) {
              delete row[relation.localField];
            }
          }
        }
      }
      return result;
    };

    const enrichResult = async (
      result: any,
      args: JsonRecord = {},
    ): Promise<any> =>
      attachManualRelations(await attachCounts(result, args), args);

    const prepareData = (
      input: JsonRecord,
      create: boolean,
    ): {
      data: JsonRecord;
      nestedCreates: Array<[RelationMeta, JsonRecord[]]>;
    } => {
      const data = serialize({ ...input });
      const nestedCreates: Array<[RelationMeta, JsonRecord[]]> = [];
      const now = new Date().toISOString();
      if (create && data.id === undefined) data.id = cuid();
      if (create && meta.timestamps) data.createdAt ??= now;
      if (meta.timestamps) data.updatedAt = now;
      for (const [key, value] of Object.entries(data)) {
        if (!value || typeof value !== "object") continue;
        const relation = meta.relations?.[key];
        if ("connect" in value && relation) {
          const connect = value.connect as JsonRecord;
          const localField = relationLocalField(key, relation);
          data[localField] = connect.id ?? Object.values(connect)[0];
          delete data[key];
          continue;
        }
        if ("create" in value && relation?.foreignField) {
          const rows = Array.isArray(value.create)
            ? value.create
            : [value.create];
          nestedCreates.push([relation, rows]);
          delete data[key];
          continue;
        }
        if ("create" in value || "connect" in value || "upsert" in value) {
          throw new Error(
            `Supabase API mode does not support nested write "${modelName}.${key}". Use an RPC for this operation.`,
          );
        }
      }
      return { data, nestedCreates };
    };

    return {
      findMany: async (args: JsonRecord = {}) => {
        const rows: any[] = [];
        const initialSkip = args.skip ?? 0;
        const requestedRows =
          args.take === undefined ? Infinity : Math.abs(args.take);
        for (
          let offset = initialSkip;
          rows.length < requestedRows;
          offset += POSTGREST_PAGE_SIZE
        ) {
          const pageSize = Math.min(
            POSTGREST_PAGE_SIZE,
            requestedRows - rows.length,
          );
          const page = await this.request(
            buildPath({
              ...args,
              skip: offset,
              take: pageSize,
            }),
            {},
            { modelName },
          );
          rows.push(...page);
          if (page.length < pageSize) break;
        }
        return enrichResult(rows, args);
      },
      findFirst: async (args: JsonRecord = {}) =>
        enrichResult(
          await this.request(
            buildPath({ ...args, take: 1 }),
            {},
            { single: true, modelName },
          ),
          args,
        ),
      findUnique: async (args: JsonRecord = {}) =>
        enrichResult(
          await this.request(
            buildPath({ ...args, take: 1 }),
            {},
            { single: true, modelName },
          ),
          args,
        ),
      count: (args: JsonRecord = {}) =>
        this.request(
          buildPath({ where: args.where, select: { id: true }, take: 1 }),
          { method: "HEAD" },
          { count: true },
        ),
      create: async (args: JsonRecord) => {
        const prepared = prepareData(args.data, true);
        const created = await this.request(
          `${meta.table}?select=${encodeURIComponent(selection(meta, args.select, args.include))}`,
          {
            method: "POST",
            body: JSON.stringify(prepared.data),
          },
          { single: true, modelName },
        );
        for (const [relation, rows] of prepared.nestedCreates) {
          const childModelName = Object.keys(models).find(
            (name) => models[name].table === relation.table,
          );
          if (!childModelName) {
            throw new Error(
              `No model mapping for nested table ${relation.table}`,
            );
          }
          const child = this.delegate(childModelName);
          await child.createMany({
            data: rows.map((row) => ({
              ...row,
              [relation.foreignField!]: created.id,
            })),
          });
        }
        if (prepared.nestedCreates.length && (args.include || args.select)) {
          return enrichResult(
            await this.request(
              buildPath({
                where: { id: created.id },
                select: args.select,
                include: args.include,
                take: 1,
              }),
              {},
              { single: true, modelName },
            ),
            args,
          );
        }
        return enrichResult(created, args);
      },
      createMany: async (args: JsonRecord) => {
        const rows = (Array.isArray(args.data) ? args.data : [args.data]).map(
          (item) => prepareData(item, true).data,
        );
        const result = await this.request(meta.table, {
          method: "POST",
          headers: args.skipDuplicates
            ? { Prefer: "resolution=ignore-duplicates,return=representation" }
            : undefined,
          body: JSON.stringify(rows),
        });
        return { count: result?.length ?? 0 };
      },
      update: async (args: JsonRecord) =>
        enrichResult(
          await this.request(
            buildPath({
              where: args.where,
              select: args.select,
              include: args.include,
            }),
            {
              method: "PATCH",
              body: JSON.stringify(prepareData(args.data, false).data),
            },
            { single: true, modelName },
          ),
          args,
        ),
      updateMany: async (args: JsonRecord) => {
        const result = await this.request(
          buildPath({ where: args.where, select: { id: true } }),
          {
            method: "PATCH",
            body: JSON.stringify(prepareData(args.data, false).data),
          },
        );
        return { count: result?.length ?? 0 };
      },
      delete: (args: JsonRecord) =>
        this.request(
          buildPath(args),
          { method: "DELETE" },
          { single: true, modelName },
        ),
      deleteMany: async (args: JsonRecord = {}) => {
        const result = await this.request(buildPath({ where: args.where }), {
          method: "DELETE",
        });
        return { count: result?.length ?? 0 };
      },
      upsert: async (args: JsonRecord) => {
        const data = prepareData({ ...args.create, ...args.update }, true).data;
        const conflictFields = Object.keys(args.where).flatMap((key) => {
          const value = args.where[key];
          return value && typeof value === "object"
            ? Object.keys(value)
            : [key];
        });
        const query = [
          `on_conflict=${encodeURIComponent(conflictFields.join(","))}`,
          `select=${encodeURIComponent(selection(meta, args.select, args.include))}`,
        ].join("&");
        return enrichResult(
          await this.request(
            `${meta.table}?${query}`,
            {
              method: "POST",
              headers: {
                Prefer: "resolution=merge-duplicates,return=representation",
              },
              body: JSON.stringify(data),
            },
            { single: true, modelName },
          ),
          args,
        );
      },
      aggregate: async (args: JsonRecord) => {
        if (args._max && Object.keys(args._max).length === 1) {
          const field = Object.keys(args._max)[0];
          const row = await this.request(
            buildPath({
              where: args.where,
              select: { [field]: true },
              orderBy: { [field]: "desc" },
              take: 1,
            }),
            {},
            { single: true, modelName },
          );
          return { _max: { [field]: row?.[field] ?? null } };
        }
        throw new Error(
          `Supabase API aggregate for ${modelName} requires a database RPC`,
        );
      },
      groupBy: () => {
        throw new Error(
          `Supabase API groupBy for ${modelName} requires a database RPC`,
        );
      },
    };
  }

  async rpc(name: string, args: JsonRecord = {}): Promise<any> {
    return this.request(`rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(serialize(args)),
    });
  }
}

export const createSupabaseApiPrismaClient = (): any => {
  const api = new SupabaseApi();
  return new Proxy(
    {
      $connect: async () => {
        await api.rpc(
          process.env.SUPABASE_CONNECTION_TEST_RPC ||
            "axpo_test_api_connection",
        );
      },
      $disconnect: async () => undefined,
      $transaction: async () => {
        throw new Error(
          "Supabase API mode cannot emulate Prisma transactions. Move this operation to a Postgres RPC.",
        );
      },
      $queryRaw: async () => {
        throw new Error(
          "Supabase API mode cannot execute Prisma raw SQL. Use a Postgres RPC.",
        );
      },
      $executeRaw: async () => {
        throw new Error(
          "Supabase API mode cannot execute Prisma raw SQL. Use a Postgres RPC.",
        );
      },
      $rpc: (name: string, args?: JsonRecord) => api.rpc(name, args),
    },
    {
      get(target, property: string) {
        if (property in target) return (target as JsonRecord)[property];
        return api.delegate(property);
      },
    },
  );
};
