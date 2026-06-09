export type DatabaseConnectionMode = "direct" | "api";

export const getDatabaseConnectionMode = (): DatabaseConnectionMode => {
  const mode = (process.env.DB_CONNECTION_MODE ?? "direct").toLowerCase();
  if (mode !== "direct" && mode !== "api") {
    throw new Error(
      `Invalid DB_CONNECTION_MODE "${mode}". Expected "direct" or "api".`,
    );
  }
  return mode;
};

export const isSupabaseApiMode = (): boolean =>
  getDatabaseConnectionMode() === "api";
