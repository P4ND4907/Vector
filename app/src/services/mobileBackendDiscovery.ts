import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import type { MobileBackendTarget } from "@/types";
import { getStoredAppBackendUrl } from "@/lib/runtime-target";

const DEFAULT_BACKEND_PORT = 8787;
const MOBILE_TARGETS_PATH = "/api/settings/mobile-targets";
const PROBE_CONNECT_TIMEOUT_MS = 1_000;
const PROBE_READ_TIMEOUT_MS = 1_500;
const MAX_CONCURRENT_PROBES = 24;
const MAX_MATCHES = 1;
const PRIORITY_CONCURRENT_PROBES = 1;
const EMULATOR_HOSTS = [
  { prefix: "10.0.2.", host: "10.0.2.2" },
  { prefix: "10.0.3.", host: "10.0.3.2" }
] as const;

type LocalNetworkTransport = "wifi" | "ethernet" | "cellular" | "vpn" | "other" | "unknown";

interface LocalNetworkAddress {
  address: string;
  prefixLength: number;
}

export interface LocalNetworkSnapshot {
  supported: boolean;
  ready: boolean;
  transport: LocalNetworkTransport;
  note: string;
  addresses: LocalNetworkAddress[];
}

interface LocalNetworkPlugin {
  getNetworkSnapshot(): Promise<LocalNetworkSnapshot>;
}

export interface MobileBackendDiscoveryResult {
  status: "found" | "multiple" | "not-found" | "unsupported";
  target?: MobileBackendTarget;
  matches: MobileBackendTarget[];
  scannedHosts: number;
  durationMs: number;
  note: string;
  network: LocalNetworkSnapshot;
}

const LocalNetwork = registerPlugin<LocalNetworkPlugin>("LocalNetwork");

const FALLBACK_NETWORK_SNAPSHOT: LocalNetworkSnapshot = {
  supported: false,
  ready: false,
  transport: "unknown",
  note: "Automatic backend discovery is available in the Android app.",
  addresses: []
};

const normalizeUrl = (value: string) => value.trim().replace(/\/$/, "");

const parseJsonPayload = (value: unknown) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  if (value && typeof value === "object") {
    return value;
  }

  return null;
};

const parseMobileBackendTargets = (value: unknown): MobileBackendTarget[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Partial<MobileBackendTarget>;
      if (typeof candidate.url !== "string" || typeof candidate.label !== "string") {
        return null;
      }

      const normalizedUrl = normalizeUrl(candidate.url);
      const kind = candidate.kind === "localhost" ? "localhost" : "lan";

      if (!normalizedUrl) {
        return null;
      }

      return {
        label: candidate.label,
        url: normalizedUrl,
        kind
      } satisfies MobileBackendTarget;
    })
    .filter((item): item is MobileBackendTarget => Boolean(item));
};

const sortHostOctetsByDistance = (current: number) =>
  [
    2,
    1,
    ...Array.from({ length: 254 }, (_, index) => index + 1).sort((left, right) => {
      const distanceDifference = Math.abs(left - current) - Math.abs(right - current);
      return distanceDifference || left - right;
    })
  ].filter((octet, index, values) => octet !== current && values.indexOf(octet) === index);

const collectSubnetHosts = (address: LocalNetworkAddress) => {
  const octets = address.address.split(".").map((segment) => Number(segment));
  if (octets.length !== 4 || octets.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
    return [];
  }

  const [first, second, third, fourth] = octets;
  const subnetPrefix = `${first}.${second}.${third}`;
  return sortHostOctetsByDistance(fourth).map((octet) => `${subnetPrefix}.${octet}`);
};

const getHostFromUrl = (value: string) => {
  try {
    return new URL(normalizeUrl(value)).hostname;
  } catch {
    return "";
  }
};

const appendUniqueHosts = (source: Iterable<string>, target: string[], seen: Set<string>) => {
  for (const host of source) {
    if (!host || seen.has(host)) {
      continue;
    }

    seen.add(host);
    target.push(host);
  }
};

const collectPriorityHosts = (snapshot: LocalNetworkSnapshot) => {
  const priorityHosts: string[] = [];
  const seen = new Set<string>();
  const storedBackendHost = getHostFromUrl(getStoredAppBackendUrl());

  appendUniqueHosts([storedBackendHost], priorityHosts, seen);

  for (const address of snapshot.addresses) {
    for (const emulatorHost of EMULATOR_HOSTS) {
      if (address.address.startsWith(emulatorHost.prefix)) {
        appendUniqueHosts([emulatorHost.host], priorityHosts, seen);
      }
    }

    const octets = address.address.split(".");
    if (octets.length !== 4) {
      continue;
    }

    const subnetPrefix = octets.slice(0, 3).join(".");
    appendUniqueHosts([`${subnetPrefix}.2`, `${subnetPrefix}.1`], priorityHosts, seen);
  }

  return priorityHosts;
};

const collectCandidateHosts = (snapshot: LocalNetworkSnapshot) => {
  const seen = new Set<string>();
  const hosts: string[] = [];
  const priorityHosts = collectPriorityHosts(snapshot);

  appendUniqueHosts(priorityHosts, hosts, seen);

  for (const address of snapshot.addresses) {
    appendUniqueHosts(collectSubnetHosts(address), hosts, seen);
  }

  return {
    hosts,
    priorityHostCount: priorityHosts.length
  };
};

const chooseTargetForHost = (host: string, targets: MobileBackendTarget[]) => {
  const normalizedTargets = parseMobileBackendTargets(targets);
  const sameHostTarget = normalizedTargets.find((target) => {
    try {
      return new URL(target.url).hostname === host;
    } catch {
      return false;
    }
  });

  if (sameHostTarget) {
    return sameHostTarget;
  }

  const lanTarget = normalizedTargets.find((target) => target.kind === "lan");
  if (lanTarget) {
    return lanTarget;
  }

  return {
    label: `LAN backend (${host})`,
    url: `http://${host}:${DEFAULT_BACKEND_PORT}`,
    kind: "lan"
  } satisfies MobileBackendTarget;
};

const probeHostForBackend = async (host: string) => {
  const baseUrl = `http://${host}:${DEFAULT_BACKEND_PORT}`;

  try {
    const response = await CapacitorHttp.get({
      url: `${baseUrl}${MOBILE_TARGETS_PATH}`,
      responseType: "json",
      connectTimeout: PROBE_CONNECT_TIMEOUT_MS,
      readTimeout: PROBE_READ_TIMEOUT_MS
    });

    if (response.status < 200 || response.status >= 300) {
      return null;
    }

    const payload = parseJsonPayload(response.data) as { targets?: unknown } | null;
    const targets = parseMobileBackendTargets(payload?.targets);

    if (!targets.length) {
      return null;
    }

    return chooseTargetForHost(host, targets);
  } catch {
    return null;
  }
};

const dedupeTargets = (targets: MobileBackendTarget[]) => {
  const seen = new Set<string>();
  const deduped: MobileBackendTarget[] = [];

  for (const target of targets) {
    if (seen.has(target.url)) {
      continue;
    }

    seen.add(target.url);
    deduped.push(target);
  }

  return deduped;
};

const scanHostsForBackendsWithLimit = async (hosts: string[], concurrencyLimit: number) => {
  const matches: MobileBackendTarget[] = [];
  let cursor = 0;
  let scannedHosts = 0;

  const worker = async () => {
    while (cursor < hosts.length && matches.length < MAX_MATCHES) {
      const index = cursor;
      cursor += 1;

      const match = await probeHostForBackend(hosts[index]);
      scannedHosts += 1;

      if (match) {
        matches.push(match);
      }
    }
  };

  const workerCount = Math.min(concurrencyLimit, Math.max(1, hosts.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    matches: dedupeTargets(matches),
    scannedHosts
  };
};

const scanHostsForBackends = async ({
  hosts,
  priorityHostCount
}: {
  hosts: string[];
  priorityHostCount: number;
}) => {
  const priorityHosts = hosts.slice(0, priorityHostCount);
  const remainingHosts = hosts.slice(priorityHostCount);

  const priorityScan = await scanHostsForBackendsWithLimit(priorityHosts, PRIORITY_CONCURRENT_PROBES);
  if (priorityScan.matches.length >= MAX_MATCHES || !remainingHosts.length) {
    return priorityScan;
  }

  const remainderScan = await scanHostsForBackendsWithLimit(remainingHosts, MAX_CONCURRENT_PROBES);
  return {
    matches: dedupeTargets([...priorityScan.matches, ...remainderScan.matches]),
    scannedHosts: priorityScan.scannedHosts + remainderScan.scannedHosts
  };
};

export const mobileBackendDiscoveryService = {
  async getNetworkSnapshot(): Promise<LocalNetworkSnapshot> {
    if (!Capacitor.isNativePlatform()) {
      return FALLBACK_NETWORK_SNAPSHOT;
    }

    try {
      const snapshot = await LocalNetwork.getNetworkSnapshot();
      return {
        supported: Boolean(snapshot.supported),
        ready: Boolean(snapshot.ready),
        transport: snapshot.transport ?? "unknown",
        note: snapshot.note || FALLBACK_NETWORK_SNAPSHOT.note,
        addresses: Array.isArray(snapshot.addresses)
          ? snapshot.addresses.filter(
              (entry): entry is LocalNetworkAddress =>
                Boolean(entry) &&
                typeof entry.address === "string" &&
                typeof entry.prefixLength === "number"
            )
          : []
      };
    } catch {
      return {
        ...FALLBACK_NETWORK_SNAPSHOT,
        note: "Android network details were unavailable, so automatic backend discovery could not start."
      };
    }
  },

  async discoverDesktopBackend(): Promise<MobileBackendDiscoveryResult> {
    const startedAt = Date.now();
    const network = await this.getNetworkSnapshot();

    if (!network.supported) {
      return {
        status: "unsupported",
        matches: [],
        scannedHosts: 0,
        durationMs: Date.now() - startedAt,
        note: network.note,
        network
      };
    }

    if (!network.ready || !network.addresses.length) {
      return {
        status: "unsupported",
        matches: [],
        scannedHosts: 0,
        durationMs: Date.now() - startedAt,
        note: network.note,
        network
      };
    }

    const { hosts, priorityHostCount } = collectCandidateHosts(network);
    const { matches, scannedHosts } = await scanHostsForBackends({ hosts, priorityHostCount });
    const durationMs = Date.now() - startedAt;

    if (matches.length === 1) {
      return {
        status: "found",
        target: matches[0],
        matches,
        scannedHosts,
        durationMs,
        note: `Found the desktop backend at ${matches[0].url}.`,
        network
      };
    }

    if (matches.length > 1) {
      return {
        status: "multiple",
        matches,
        scannedHosts,
        durationMs,
        note: "More than one desktop backend answered on this network. Pick the right one below.",
        network
      };
    }

    return {
      status: "not-found",
      matches: [],
      scannedHosts,
      durationMs,
      note: "No desktop backend answered on this Wi-Fi yet. Make sure the desktop app is open and both devices are on the same network.",
      network
    };
  },

  async discoverDesktopBackendWithRetry({
    attempts = 3,
    retryDelayMs = 1_200
  }: {
    attempts?: number;
    retryDelayMs?: number;
  } = {}): Promise<MobileBackendDiscoveryResult> {
    const maxAttempts = Math.max(1, Math.floor(attempts));
    let lastResult = await this.discoverDesktopBackend();

    for (let attemptIndex = 1; attemptIndex < maxAttempts; attemptIndex += 1) {
      if (lastResult.status !== "not-found") {
        return lastResult;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      lastResult = await this.discoverDesktopBackend();
    }

    return lastResult;
  }
};
