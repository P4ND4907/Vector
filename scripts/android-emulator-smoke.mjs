import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const defaults = {
  apk: path.join(repoRoot, 'app', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  outputDir: path.join(repoRoot, 'artifacts', 'android-smoke'),
  packageName: 'com.vectorcontrolhub.app',
  launchWaitMs: 15000,
  serial: '',
};

function parseArgs(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--apk' && next) {
      options.apk = path.resolve(next);
      index += 1;
      continue;
    }

    if (token === '--output-dir' && next) {
      options.outputDir = path.resolve(next);
      index += 1;
      continue;
    }

    if (token === '--package' && next) {
      options.packageName = next;
      index += 1;
      continue;
    }

    if (token === '--serial' && next) {
      options.serial = next;
      index += 1;
      continue;
    }

    if (token === '--launch-wait-ms' && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.launchWaitMs = parsed;
      }
      index += 1;
    }
  }
  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  const {
    allowFailure = false,
    encoding = 'utf8',
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      const stdoutBuffer = Buffer.concat(stdoutChunks);
      const stderrBuffer = Buffer.concat(stderrChunks);
      const stdout = encoding === 'buffer' ? stdoutBuffer : stdoutBuffer.toString('utf8');
      const stderr = encoding === 'buffer' ? stderrBuffer : stderrBuffer.toString('utf8');

      if (code !== 0 && !allowFailure) {
        const error = new Error(
          `${command} ${args.join(' ')} failed with exit code ${code}\n${typeof stderr === 'string' ? stderr.trim() : ''}`.trim(),
        );
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ code, stdout, stderr });
    });
  });
}

async function adb(serial, args, options = {}) {
  const commandArgs = serial ? ['-s', serial, ...args] : args;
  return run('adb', commandArgs, options);
}

async function detectSerial(preferredSerial) {
  if (preferredSerial) {
    return preferredSerial;
  }

  const devices = await run('adb', ['devices']);
  const lines = devices.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'));

  const online = lines
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);

  if (online.length === 0) {
    throw new Error('No Android emulator or device is online. Start an emulator first.');
  }

  return online[0];
}

async function waitForBoot(serial) {
  await adb(serial, ['wait-for-device']);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const bootProp = await adb(serial, ['shell', 'getprop', 'sys.boot_completed'], { allowFailure: true });
    if (String(bootProp.stdout).trim() === '1') {
      return;
    }
    await sleep(2000);
  }

  throw new Error(`Timed out waiting for emulator ${serial} to finish booting.`);
}

async function resolveLaunchActivity(serial, packageName) {
  const resolved = await adb(
    serial,
    ['shell', 'cmd', 'package', 'resolve-activity', '--brief', packageName],
    { allowFailure: true },
  );

  const line = String(resolved.stdout)
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reverse()
    .find((entry) => entry.includes('/'));

  return line || `${packageName}/.MainActivity`;
}

async function writeBinaryAdbOutput(serial, args, targetPath) {
  const result = await adb(serial, args, { encoding: 'buffer' });
  await writeFile(targetPath, result.stdout);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outputDir, { recursive: true });

  const summary = {
    packageName: options.packageName,
    apk: options.apk,
    outputDir: options.outputDir,
    serial: '',
    activity: '',
    pid: '',
    launchWaitMs: options.launchWaitMs,
    crashDetected: false,
    focusedOnApp: false,
    passed: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const serial = await detectSerial(options.serial);
    summary.serial = serial;

    await waitForBoot(serial);
    await adb(serial, ['logcat', '-c'], { allowFailure: true });
    await adb(serial, ['shell', 'input', 'keyevent', '82'], { allowFailure: true });
    await adb(serial, ['install', '-r', '-g', options.apk]);
    await adb(serial, ['shell', 'pm', 'clear', options.packageName], { allowFailure: true });

    const activity = await resolveLaunchActivity(serial, options.packageName);
    summary.activity = activity;

    await adb(serial, ['shell', 'am', 'start', '-W', '-n', activity]);
    await sleep(options.launchWaitMs);

    const pidResult = await adb(serial, ['shell', 'pidof', '-s', options.packageName], { allowFailure: true });
    summary.pid = String(pidResult.stdout).trim();

    const focusDump = await adb(serial, ['shell', 'dumpsys', 'window', 'windows'], { allowFailure: true });
    summary.focusedOnApp = String(focusDump.stdout).includes(options.packageName);

    const activityDump = await adb(serial, ['shell', 'dumpsys', 'activity', 'activities'], { allowFailure: true });
    await writeFile(path.join(options.outputDir, 'activity-dump.txt'), String(activityDump.stdout));
    await writeFile(path.join(options.outputDir, 'window-dump.txt'), String(focusDump.stdout));

    await writeBinaryAdbOutput(serial, ['exec-out', 'screencap', '-p'], path.join(options.outputDir, 'screenshot.png'));
    const uiDump = await adb(serial, ['exec-out', 'uiautomator', 'dump', '/dev/tty'], { allowFailure: true });
    await writeFile(path.join(options.outputDir, 'ui-dump.xml'), String(uiDump.stdout));

    const logcat = await adb(serial, ['logcat', '-d'], { allowFailure: true });
    const logcatText = String(logcat.stdout);
    await writeFile(path.join(options.outputDir, 'logcat.txt'), logcatText);

    summary.crashDetected =
      logcatText.includes('FATAL EXCEPTION') &&
      (logcatText.includes(options.packageName) || logcatText.includes('AndroidRuntime'));
    summary.passed = Boolean(summary.pid) && summary.focusedOnApp && !summary.crashDetected;
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
  }

  await writeFile(path.join(options.outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  if (!summary.passed) {
    throw new Error(summary.error || 'Android smoke test failed. Check artifacts in the output directory for details.');
  }

  console.log(`Android smoke test passed on ${summary.serial} for ${summary.packageName}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
