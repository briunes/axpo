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