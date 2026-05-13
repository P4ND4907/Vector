import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/services/apiClient";

interface EngineHealthPayload {
  provider: "embedded" | "wirepod" | "mock";
  health: {
    ok: boolean;
    provider: "embedded" | "wirepod" | "mock";
    note: string;
  };
  integration: {
    note?: string;
  };
}

export const useEngineStatus = () => {
  const [status, setStatus] = useState<EngineHealthPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getJson<EngineHealthPayload>(
        "/api/engine/health",
        "Engine health could not be loaded."
      );
      setStatus(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Engine health could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    loading,
    error,
    refresh
  };
};
