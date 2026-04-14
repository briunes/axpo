import fs from "fs";
import path from "path";

describe("Prisma migration readiness", () => {
  it("has migration lock and at least one migration.sql file", () => {
    const migrationsRoot = path.resolve(process.cwd(), "prisma", "migrations");
    const lockFile = path.join(migrationsRoot, "migration_lock.toml");

    expect(fs.existsSync(migrationsRoot)).toBe(true);
    expect(fs.existsSync(lockFile)).toBe(true);

    const migrationDirs = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(migrationDirs.length).toBeGreaterThan(0);

    const hasMigrationSql = migrationDirs.some((dir) => {
      const migrationFile = path.join(migrationsRoot, dir, "migration.sql");
      return fs.existsSync(migrationFile);
    });

    expect(hasMigrationSql).toBe(true);
  });
});