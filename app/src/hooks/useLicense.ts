import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "@/services/apiClient";

export type LicenseTier = "free" | "pro";

export interface LicenseStatus {
  tier: LicenseTier;
  activatedAt?: string;
  features: string[];
  loading: boolean;
  error: string | null;
  activate: (key: string) => Promise<{ success: boolean; message: string }>;
  refresh: () => void;
}

interface LicenseStatusResponse {
  tier: LicenseTier;
  activatedAt?: string;
  features: string[];
}

interface ActivateResponse {
  success: boolean;
  message: string;
}

export function useLicense(): LicenseStatus {
  const [tier, setTier] = useState<LicenseTier>("free");
  const [activatedAt, setActivatedAt] = useState<string | undefined>(undefined);
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<LicenseStatusResponse>("/api/license/status");
      setTier(data.tier);
      setActivatedAt(data.activatedAt);
      setFeatures(data.features ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch license status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const activate = useCallback(
    async (key: string): Promise<{ success: boolean; message: string }> => {
      try {
        const data = await postJson<ActivateResponse>("/api/license/activate", { key });
        if (data.success) {
          await fetchStatus();
        }
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Activation failed";
        return { success: false, message };
      }
    },
    [fetchStatus]
  );

  return { tier, activatedAt, features, loading, error, activate, refresh: fetchStatus };
}
