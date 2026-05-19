import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export const getFirstOpenMarkerPath = (rootDir = repoRoot) =>
  path.join(rootDir, ".git", ".pandora-first-open-complete");

export const sanitizeNpmEnv = (env = process.env) => {
  const nextEnv = { ...env };
  for (const key of Object.keys(nextEnv)) {
    if (/^npm_config_(?:https?_proxy|https?-proxy|proxy)$/i.test(key)) {
      delete nextEnv[key];
    }
  }
  return nextEnv;
};

export const createExecutionPlan = ({ firstOpen, hasUpstream, worktreeClean = true }) => [
  ...(firstOpen && hasUpstream && worktreeClean
    ? [{ label: "Fast-forward pull", command: "git", args: ["pull", "--ff-only"] }]
    : []),
  ...(firstOpen
    ? [{ label: "First-open test bootstrap", command: npmCommand, args: ["test"] }]
    : []),
  {
    label: "Release readiness gate",
    command: npmCommand,
    args: ["run", "verify:ci"]
  }
];

export const hasGitUpstream = (rootDir = repoRoot) => {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
    cwd: rootDir,
    encoding: "utf8",
    env: sanitizeNpmEnv()
  });

  return result.status === 0 && result.stdout.trim().length > 0;
};

export const isGitWorktreeClean = (rootDir = repoRoot) => {
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: rootDir,
    encoding: "utf8",
    env: sanitizeNpmEnv()
  });

  return result.status === 0 && result.stdout.trim().length === 0;
};

const runStep = (step, rootDir) => {
  console.log(`\n[pandora] ${step.label}: ${step.command} ${step.args.join(" ")}`);
  const useWindowsShell = process.platform === "win32";
  const result = spawnSync(
    useWindowsShell ? formatWindowsShellCommand(step) : step.command,
    useWindowsShell ? [] : step.args,
    {
    cwd: rootDir,
    env: sanitizeNpmEnv(),
    shell: useWindowsShell,
    stdio: "inherit"
    }
  );

  if (result.error) {
    console.error(result.error);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const formatWindowsShellCommand = (step) =>
  [step.command, ...step.args].map(quoteWindowsShellToken).join(" ");

const quoteWindowsShellToken = (token) =>
  /[\s&()^|<>"]/u.test(token) ? `"${token.replaceAll('"', '\\"')}"` : token;

export const markFirstOpenComplete = async (rootDir = repoRoot) => {
  const markerPath = getFirstOpenMarkerPath(rootDir);
  await mkdir(path.dirname(markerPath), { recursive: true });
  await writeFile(markerPath, `completedAt=${new Date().toISOString()}\n`, "utf8");
};

export const runPandoraReleaseGate = async (rootDir = repoRoot) => {
  const markerPath = getFirstOpenMarkerPath(rootDir);
  const firstOpen = !existsSync(markerPath);
  const upstream = firstOpen ? hasGitUpstream(rootDir) : false;
  const worktreeClean = firstOpen ? isGitWorktreeClean(rootDir) : true;
  const plan = createExecutionPlan({ firstOpen, hasUpstream: upstream, worktreeClean });

  if (firstOpen && !upstream) {
    console.log("[pandora] No upstream tracking branch found; skipping auto-pull.");
  } else if (firstOpen && !worktreeClean) {
    console.log("[pandora] Local changes found; skipping auto-pull.");
  }

  for (const step of plan) {
    runStep(step, rootDir);
    if (step.label === "First-open test bootstrap") {
      await markFirstOpenComplete(rootDir);
    }
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPandoraReleaseGate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
