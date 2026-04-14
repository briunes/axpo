const fs = require("fs");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const backendRoot = process.cwd();

const baseDefinition = {
  openapi: "3.0.0",
  info: {
    title: "AXPO Simulador de Ofertas - API v1",
    version: "0.2.0",
    contact: {
      name: "AXPO Development",
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Bearer token for internal API access",
      },
      tokenAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Public-Token",
        description: "Public access token",
      },
      pinAuth: {
        type: "apiKey",
        in: "header",
        name: "X-PIN",
        description: "4-digit PIN for public access",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "object",
            properties: {
              code: {
                type: "string",
                example: "VALIDATION_ERROR",
              },
              message: {
                type: "string",
                example: "Validation failed",
              },
              details: {
                type: "object",
                example: { field: "email", reason: "Invalid email format" },
              },
            },
          },
          timestamp: {
            type: "string",
            format: "date-time",
          },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: {
            type: "integer",
            example: 1,
          },
          pageSize: {
            type: "integer",
            example: 20,
          },
          total: {
            type: "integer",
            example: 42,
          },
          hasMore: {
            type: "boolean",
            example: true,
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          fullName: { type: "string" },
          role: { type: "string", enum: ["ADMIN", "AGENT", "COMMERCIAL"] },
          agencyId: { type: "string", format: "uuid" },
          pin: { type: "string", example: "1234" },
          isDeleted: { type: "boolean" },
          contactInfo: { type: "string", nullable: true },
          commercialName: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Agency: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          street: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
          postalCode: { type: "string", nullable: true },
          province: { type: "string", nullable: true },
          country: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Client: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          agencyId: { type: "string", format: "uuid" },
          cif: { type: "string", nullable: true },
          contactName: { type: "string", nullable: true },
          contactEmail: { type: "string", format: "email", nullable: true },
          contactPhone: { type: "string", nullable: true },
          otherDetails: { type: "string", nullable: true },
          isDeleted: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Simulation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          ownerUserId: { type: "string", format: "uuid" },
          clientId: { type: "string", format: "uuid", nullable: true },
          publicToken: { type: "string", nullable: true },
          publicPinHash: { type: "string", nullable: true },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          isDeleted: { type: "boolean" },
          baseValueSetId: { type: "string", format: "uuid", nullable: true },
          payloadJson: { type: "object", nullable: true },
          cupsNumber: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      BaseValueSet: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          version: { type: "integer" },
          isActive: { type: "boolean" },
          isDeleted: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AuditLog: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          action: { type: "string" },
          userId: { type: "string", format: "uuid", nullable: true },
          entityType: { type: "string", nullable: true },
          entityId: { type: "string", nullable: true },
          metadata: { type: "object", nullable: true },
          ipAddress: { type: "string", nullable: true },
          userAgent: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 12, maxLength: 128 },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      CreateAgencyRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 2 },
          street: { type: "string" },
          city: { type: "string" },
          postalCode: { type: "string" },
          province: { type: "string" },
          country: { type: "string" },
        },
      },
      CreateClientRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          agencyId: { type: "string", format: "uuid" },
          cif: { type: "string", maxLength: 50 },
          contactName: { type: "string", maxLength: 200 },
          contactEmail: { type: "string", format: "email" },
          contactPhone: { type: "string", maxLength: 50 },
          otherDetails: { type: "string", maxLength: 5000 },
        },
      },
      CreateSimulationRequest: {
        type: "object",
        properties: {
          ownerUserId: { type: "string", format: "uuid" },
          clientId: { type: "string", format: "uuid" },
          expiresAt: { type: "string", format: "date-time" },
          payloadJson: { type: "object" },
          baseValueSetId: { type: "string", format: "uuid" },
        },
      },
      CreateUserRequest: {
        type: "object",
        required: ["email", "fullName", "role", "password"],
        properties: {
          email: { type: "string", format: "email" },
          fullName: { type: "string", minLength: 2 },
          role: { type: "string", enum: ["ADMIN", "AGENT", "COMMERCIAL"] },
          password: { type: "string", minLength: 12, maxLength: 128 },
          agencyId: { type: "string", format: "uuid" },
          contactInfo: { type: "string" },
          commercialName: { type: "string" },
        },
      },
      EmailTemplate: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          templateKey: { type: "string" },
          name: { type: "string" },
          subject: { type: "string" },
          htmlBody: { type: "string" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PDFTemplate: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          templateKey: { type: "string" },
          name: { type: "string" },
          htmlBody: { type: "string" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      SystemConfig: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          configKey: { type: "string" },
          configValue: { type: "string" },
          description: { type: "string", nullable: true },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

// Generate Internal API Spec
const internalFileGlobs = [
  path.join(backendRoot, "app", "api", "v1", "internal", "**", "*.ts"),
];

const internalSwaggerOptions = {
  definition: {
    ...baseDefinition,
    info: {
      ...baseDefinition.info,
      title: "AXPO Simulador de Ofertas - Internal API v1",
      description: `
# Internal API

Secure internal API for AXPO simulation management with role-based access control.

## Features
- RBAC (Admin/Agent/Commercial)
- Simulation versioning and cloning
- Base values management with versioning
- Audit logging for all critical operations
- Soft delete preservation

## Authentication
- **Bearer JWT token** (required)

## Base URL
- \`/api/v1/internal\`

## Response Format
All responses follow a standard structure:
\`\`\`json
{
  "success": true/false,
  "data": {...},
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {...}
  },
  "timestamp": "2026-03-11T10:00:00Z"
}
\`\`\`
      `,
    },
    servers: [
      {
        url: "/",
        description: "Internal API (requires Bearer JWT authentication)",
      },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: internalFileGlobs,
};

const internalSpec = swaggerJsdoc(internalSwaggerOptions);
internalSpec.paths = Object.fromEntries(
  Object.entries(internalSpec.paths || {}).filter(([route]) =>
    route.startsWith("/api/v1/internal/")
  )
);
const internalOutputPath = path.join(
  backendRoot,
  "src",
  "infrastructure",
  "openapi-internal.json"
);

fs.writeFileSync(internalOutputPath, JSON.stringify(internalSpec, null, 2));
console.log(`Generated Internal API spec at ${internalOutputPath}`);
console.log(
  `internal_paths_count=${Object.keys(internalSpec.paths || {}).length}`
);

// Generate Public API Spec
const publicFileGlobs = [
  path.join(backendRoot, "app", "api", "v1", "public", "**", "*.ts"),
];

const publicSwaggerOptions = {
  definition: {
    ...baseDefinition,
    info: {
      ...baseDefinition.info,
      title: "AXPO Simulador de Ofertas - Public API v1",
      description: `
# Public API

Public API for accessing AXPO simulations via secure token+PIN mechanism.

## Features
- Token-based access control
- PIN verification (4 digits)
- Read-only simulation access
- Secure expiration handling

## Authentication
- **Public Token** (X-Public-Token header)
- **PIN** (X-PIN header, 4 digits)

## Base URL
- \`/api/v1/public\`

## Response Format
All responses follow a standard structure:
\`\`\`json
{
  "success": true/false,
  "data": {...},
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {...}
  },
  "timestamp": "2026-03-11T10:00:00Z"
}
\`\`\`
      `,
    },
    servers: [
      {
        url: "/",
        description:
          "Public API (token+PIN authentication, no internal user auth required)",
      },
    ],
    security: [
      {
        tokenAuth: [],
      },
      {
        pinAuth: [],
      },
    ],
  },
  apis: publicFileGlobs,
};

const publicSpec = swaggerJsdoc(publicSwaggerOptions);
const publicOutputPath = path.join(
  backendRoot,
  "src",
  "infrastructure",
  "openapi-public.json"
);

fs.writeFileSync(publicOutputPath, JSON.stringify(publicSpec, null, 2));
console.log(`Generated Public API spec at ${publicOutputPath}`);
console.log(
  `public_paths_count=${Object.keys(publicSpec.paths || {}).length}`
);
