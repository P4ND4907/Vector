import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/services/apiClient";

export interface EngineStatusResult {
  provider: "embedded" | "wirepod" | "mock";
  available: boolean;
  connected: boolean;
  note: string;
  protocolGaps: string[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface EngineStatusResponse {
  provider: "embedded" | "wirepod" | "mock";
  available: boolean;
  connected: boolean;
  note: string;
  protocolGaps: string[];
}

const POLL_INTERVAL_MS = 10_000;

export function useEngineStatus(): EngineStatusResult {
  const [provider, setProvider] = useState<"embedded" | "wirepod" | "mock">("mock");
  const [available, setAvailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [note, setNote] = useState("");
  const [protocolGaps, setProtocolGaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<EngineStatusResponse>("/api/engine/status");
      setProvider(data.provider);
      setAvailable(data.available);
      setConnected(data.connected);
      setNote(data.note ?? "");
      setProtocolGaps(data.protocolGaps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch engine status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return { provider, available, connected, note, protocolGaps, loading, error, refresh: fetchStatus };
}
