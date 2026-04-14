import fs from "fs";
import path from "path";

describe("workspace structure guard", () => {
  it("does not allow a duplicate root-level app directory", () => {
    const duplicateRootApp = path.resolve(process.cwd(), "..", "app");
    expect(fs.existsSync(duplicateRootApp)).toBe(false);
  });
});