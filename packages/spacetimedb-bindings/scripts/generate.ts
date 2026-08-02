import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const modulePath = resolve(repositoryRoot, "coordinator/spacetimedb");
const generatedPath = resolve(packageRoot, "generated");
const spacetime = process.env.SPACETIME_BIN ?? "spacetime";
const checkOnly = process.argv.includes("--check");

if (!existsSync(join(modulePath, "Cargo.toml"))) {
  throw new Error("Coordinator source is missing: coordinator/spacetimedb/Cargo.toml");
}

function generate(outputPath: string) {
  execFileSync(
    spacetime,
    [
      "generate",
      "--lang",
      "typescript",
      "--out-dir",
      outputPath,
      "--module-path",
      modulePath,
      "--yes",
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
}

function filesAt(directory: string, base = directory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesAt(path, base) : [relative(base, path)];
  });
}

if (checkOnly) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "study-abroad-bindings-"));
  const temporaryOutput = join(temporaryRoot, "generated");
  try {
    generate(temporaryOutput);
    const expected = filesAt(temporaryOutput).sort();
    const actual = existsSync(generatedPath) ? filesAt(generatedPath).sort() : [];
    const changed = expected.filter((file) => {
      const actualFile = join(generatedPath, file);
      return !existsSync(actualFile) || readFileSync(join(temporaryOutput, file), "utf8") !== readFileSync(actualFile, "utf8");
    });
    const removed = actual.filter((file) => !expected.includes(file));
    if (changed.length > 0 || removed.length > 0) {
      throw new Error(`Generated bindings are stale. Run pnpm spacetime:generate (${[...changed, ...removed].join(", ")})`);
    }
    console.log("Generated bindings are up to date.");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
} else {
  const temporaryRoot = mkdtempSync(join(packageRoot, ".generated-"));
  const temporaryOutput = join(temporaryRoot, "generated");
  try {
    generate(temporaryOutput);
    rmSync(generatedPath, { recursive: true, force: true });
    renameSync(temporaryOutput, generatedPath);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
