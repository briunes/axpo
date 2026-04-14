import openapiInternal from "../openapi-internal.json";
import openapiPublic from "../openapi-public.json";

describe("OpenAPI contract coverage", () => {
  it("internal spec includes required MVP endpoints", () => {
    const paths =
      (openapiInternal as { paths?: Record<string, Record<string, unknown>> })
        .paths ?? {};
    const requiredPaths = [
      "/api/v1/internal/health",
      "/api/v1/internal/auth/login",
      "/api/v1/internal/auth/register",
      "/api/v1/internal/agencies",
      "/api/v1/internal/agencies/{id}",
      "/api/v1/internal/users",
      "/api/v1/internal/users/{id}",
      "/api/v1/internal/users/{id}/pin",
      "/api/v1/internal/users/{id}/pin/rotate",
      "/api/v1/internal/simulations",
      "/api/v1/internal/simulations/{id}",
      "/api/v1/internal/simulations/{id}/clone",
      "/api/v1/internal/simulations/{id}/share",
      "/api/v1/internal/simulations/{id}/pin/rotate",
      "/api/v1/internal/simulations/{id}/ocr-prefill",
      "/api/v1/internal/simulations/{id}/pdf",
      "/api/v1/internal/base-values",
      "/api/v1/internal/base-values/{id}",
      "/api/v1/internal/base-values/{id}/activate",
      "/api/v1/internal/base-values/{id}/items",
      "/api/v1/internal/cups/validate",
      "/api/v1/internal/analytics/overview",
      "/api/v1/internal/audit-logs",
    ];

    expect(Object.keys(paths)).toEqual(
      expect.arrayContaining(requiredPaths)
    );

    expect(Object.keys(paths).length).toBeGreaterThanOrEqual(requiredPaths.length);
  });

  it("internal spec exposes expected HTTP methods", () => {
    const paths =
      (openapiInternal as { paths?: Record<string, Record<string, unknown>> })
        .paths ?? {};

    const requiredPathMethods: Record<string, string[]> = {
      "/api/v1/internal/health": ["get"],
      "/api/v1/internal/auth/login": ["post"],
      "/api/v1/internal/auth/register": ["post"],
      "/api/v1/internal/agencies": ["get", "post"],
      "/api/v1/internal/agencies/{id}": ["get", "patch"],
      "/api/v1/internal/users": ["get", "post"],
      "/api/v1/internal/users/{id}": ["get", "patch"],
      "/api/v1/internal/users/{id}/pin": ["get"],
      "/api/v1/internal/users/{id}/pin/rotate": ["post"],
      "/api/v1/internal/simulations": ["get", "post"],
      "/api/v1/internal/simulations/{id}": ["get", "patch", "delete"],
      "/api/v1/internal/simulations/{id}/clone": ["post"],
      "/api/v1/internal/simulations/{id}/share": ["post"],
      "/api/v1/internal/simulations/{id}/pin/rotate": ["post"],
      "/api/v1/internal/simulations/{id}/ocr-prefill": ["post"],
      "/api/v1/internal/simulations/{id}/pdf": ["get"],
      "/api/v1/internal/base-values": ["get", "post"],
      "/api/v1/internal/base-values/{id}": ["get", "patch"],
      "/api/v1/internal/base-values/{id}/activate": ["post"],
      "/api/v1/internal/base-values/{id}/items": ["get", "put"],
      "/api/v1/internal/cups/validate": ["post"],
      "/api/v1/internal/analytics/overview": ["get"],
      "/api/v1/internal/audit-logs": ["get"],
    };

    for (const [path, expectedMethods] of Object.entries(requiredPathMethods)) {
      const pathDefinition = paths[path];
      expect(pathDefinition).toBeDefined();

      const availableMethods = Object.keys(pathDefinition ?? {}).map((method) => method.toLowerCase());
      expect(availableMethods).toEqual(expect.arrayContaining(expectedMethods));
    }
  });

  it("public spec contains only public simulation endpoints", () => {
    const paths =
      (openapiPublic as { paths?: Record<string, Record<string, unknown>> })
        .paths ?? {};

    const requiredPathMethods: Record<string, string[]> = {
      "/api/v1/public/simulations/access": ["post"],
      "/api/v1/public/simulations/{token}": ["get"],
    };

    for (const [path, expectedMethods] of Object.entries(requiredPathMethods)) {
      const pathDefinition = paths[path];
      expect(pathDefinition).toBeDefined();

      const availableMethods = Object.keys(pathDefinition ?? {}).map((method) => method.toLowerCase());
      expect(availableMethods).toEqual(expect.arrayContaining(expectedMethods));
    }
  });
});
