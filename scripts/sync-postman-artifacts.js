const fs = require("fs");
const path = require("path");

const backendRoot = process.cwd();
const repoRoot = path.resolve(backendRoot, "..");
const sourceDir = path.join(repoRoot, "docs", "postman");
const targetDir = path.join(backendRoot, "public", "postman");

const artifactNames = [
  "axpo-simulator.postman_collection.json",
  "axpo-simulator.postman_environment.json",
];

// If the source directory doesn't exist (e.g. in CI/Vercel where the project
// is the repo root), skip syncing — the files should already be committed to
// public/postman in the repository.
if (!fs.existsSync(sourceDir)) {
  console.log(
    `Postman source directory not found (${sourceDir}), skipping sync.`
  );
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

for (const artifactName of artifactNames) {
  const sourcePath = path.join(sourceDir, artifactName);
  const targetPath = path.join(targetDir, artifactName);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing Postman source artifact: ${sourcePath}`);
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`synced_postman_artifact=${artifactName}`);
}