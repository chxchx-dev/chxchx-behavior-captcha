import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this script with `npm run pack:smoke`.");

const tempRoot = await mkdtemp(join(tmpdir(), "behavior-captcha-pack-"));
const consumerDirectory = join(tempRoot, "consumer");
const runNpm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], {
  cwd,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  runNpm(["pack", "--pack-destination", tempRoot], repositoryRoot);
  const tarball = (await readdir(tempRoot)).find((name) => name.endsWith(".tgz"));
  assert.ok(tarball, "npm pack should produce a tarball");

  const peerVersions = {};
  for (const dependency of ["react", "react-dom"]) {
    const metadata = JSON.parse(await readFile(join(repositoryRoot, "node_modules", dependency, "package.json"), "utf8"));
    peerVersions[dependency] = metadata.version;
  }
  const appPackage = JSON.parse(await readFile(join(repositoryRoot, "examples/next-app/package.json"), "utf8"));
  const rootPackage = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  const consumerFixture = join(repositoryRoot, "tests/fixtures/next-consumer");
  await cp(consumerFixture, consumerDirectory, { recursive: true });
  const consumerPackagePath = join(consumerDirectory, "package.json");
  const consumerPackage = JSON.parse(await readFile(consumerPackagePath, "utf8"));
  consumerPackage.dependencies = {
    ...consumerPackage.dependencies,
    ...peerVersions,
    next: appPackage.dependencies.next,
    "@chxchx/behavior-captcha": `file:${relative(consumerDirectory, join(tempRoot, tarball)).split(sep).join("/")}`,
  };
  consumerPackage.devDependencies = rootPackage.devDependencies;
  await writeFile(consumerPackagePath, JSON.stringify(consumerPackage, null, 2));
  runNpm([
    "install",
    "--no-audit",
    "--no-fund",
  ], consumerDirectory);

  const packageDirectory = join(consumerDirectory, "node_modules", "@chxchx", "behavior-captcha");
  for (const path of [
    "dist/client/index.d.ts",
    "dist/server/index.d.ts",
    "dist/shared/index.d.ts",
    "dist/client/styles.css",
    "bin/prune-expired.mjs",
    "docs/deployment.md",
    "docs/security.md",
    "docs/README.md",
  ]) {
    await access(join(packageDirectory, path));
  }

  const checkFile = join(consumerDirectory, "check.mjs");
  await writeFile(checkFile, `
    import assert from "node:assert/strict";
    import * as client from "@chxchx/behavior-captcha/client";
    import * as server from "@chxchx/behavior-captcha/server";
    import * as shared from "@chxchx/behavior-captcha/shared";
    assert.equal(typeof client.BehaviorForm, "function");
    assert.equal(typeof server.handleBehaviorSubmission, "function");
    assert.equal(typeof shared.BEHAVIOR_FIELD, "string");
    assert.ok(import.meta.resolve("@chxchx/behavior-captcha/styles.css").endsWith("/dist/client/styles.css"));
  `);
  execFileSync(process.execPath, [checkFile], { cwd: consumerDirectory, stdio: "inherit" });
  runNpm(["run", "build"], consumerDirectory);

  const packageMetadata = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
  assert.equal(packageMetadata.license, "MIT");
  assert.equal(packageMetadata.bin["behavior-captcha-prune"], "./bin/prune-expired.mjs");
  const licenseText = await readFile(join(packageDirectory, "LICENSE"), "utf8");
  assert.match(licenseText, /^MIT License/m);
  assert.match(licenseText, /Copyright \(c\) 2026 chxchx-dev/);
  assert.deepEqual(packageMetadata.bin, { "behavior-captcha-prune": "./bin/prune-expired.mjs" });
  const pruneOutput = execFileSync(process.execPath, [join(packageDirectory, "bin/prune-expired.mjs")], {
    cwd: consumerDirectory,
    encoding: "utf8",
    env: {
      ...process.env,
      BEHAVIOR_CAPTCHA_DB_PATH: join(tempRoot, "prune-smoke.sqlite"),
      RATE_LIMIT_KEY_HASH_SECRET: "package-smoke-prune-secret-at-least-32-characters",
    },
  });
  assert.deepEqual(JSON.parse(pruneOutput), { rateLimitBuckets: 0, challenges: 0 });
  console.log("Packed package installed and built in a clean Next.js app; exports, CSS, docs, MIT license, and SQLite cleanup command work.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
