import { useCallback, useEffect, useMemo, useState } from "react";
import { listWorkspaces } from "../../../services/tauri";
import type { AppSettings } from "../../../types";
import { isMobilePlatform } from "../../../utils/platformPaths";
import type { MobileServerSetupWizardProps } from "../components/MobileServerSetupWizard";

type UseMobileServerSetupParams = {
  appSettings: AppSettings;
  appSettingsLoading: boolean;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
  refreshWorkspaces: () => Promise<unknown>;
};

type UseMobileServerSetupResult = {
  isMobileRuntime: boolean;
  showMobileSetupWizard: boolean;
  mobileSetupWizardProps: MobileServerSetupWizardProps;
  handleMobileConnectSuccess: () => Promise<void>;
};

function isRemoteServerConfigured(settings: AppSettings): boolean {
  return Boolean(settings.remoteBackendToken?.trim()) && Boolean(settings.remoteBackendHost.trim());
}

function defaultMobileSetupMessage(): string {
  return "Enter your desktop Tailscale host and token, then run Connect & test.";
}

export function useMobileServerSetup({
  appSettings,
  appSettingsLoading,
  queueSaveSettings,
  refreshWorkspaces,
}: UseMobileServerSetupParams): UseMobileServerSetupResult {
  const isMobileRuntime = useMemo(() => isMobilePlatform(), []);

  const [remoteHostDraft, setRemoteHostDraft] = useState(appSettings.remoteBackendHost);
  const [remoteTokenDraft, setRemoteTokenDraft] = useState(appSettings.remoteBackendToken ?? "");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [mobileServerReady, setMobileServerReady] = useState(!isMobileRuntime);

  useEffect(() => {
    if (!isMobileRuntime) {
      return;
    }
    setRemoteHostDraft(appSettings.remoteBackendHost);
    setRemoteTokenDraft(appSettings.remoteBackendToken ?? "");
  }, [
    appSettings.remoteBackendHost,
    appSettings.remoteBackendToken,
    isMobileRuntime,
  ]);

  const runConnectivityCheck = useCallback(
    async (options?: { announceSuccess?: boolean }) => {
      if (!isMobileRuntime) {
        return true;
      }
      try {
        const entries = await listWorkspaces();
        try {
          await refreshWorkspaces();
        } catch {
          // Connectivity is confirmed by listWorkspaces; refresh is best-effort.
        }
        setMobileServerReady(true);
        setStatusError(false);
        if (options?.announceSuccess) {
          const count = entries.length;
          const workspaceWord = count === 1 ? "workspace" : "workspaces";
          setStatusMessage(`Connected. ${count} ${workspaceWord} available from your desktop backend.`);
        } else {
          setStatusMessage(null);
        }
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to reach remote backend.";
        setMobileServerReady(false);
        setStatusError(true);
        setStatusMessage(message);
        return false;
      }
    },
    [isMobileRuntime, refreshWorkspaces],
  );

  const onConnectTest = useCallback(() => {
    void (async () => {
      if (!isMobileRuntime || busy) {
        return;
      }

      const nextHost = remoteHostDraft.trim();
      const nextToken = remoteTokenDraft.trim() ? remoteTokenDraft.trim() : null;

      if (!nextHost || !nextToken) {
        setMobileServerReady(false);
        setStatusError(true);
        setStatusMessage(defaultMobileSetupMessage());
        return;
      }

      setBusy(true);
      setStatusError(false);
      setStatusMessage(null);
      try {
        await queueSaveSettings({
          ...appSettings,
          backendMode: "remote",
          remoteBackendProvider: "tcp",
          remoteBackendHost: nextHost,
          remoteBackendToken: nextToken,
        });
        await runConnectivityCheck({ announceSuccess: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save remote backend settings.";
        setMobileServerReady(false);
        setStatusError(true);
        setStatusMessage(message);
      } finally {
        setBusy(false);
      }
    })();
  }, [
    appSettings,
    busy,
    isMobileRuntime,
    queueSaveSettings,
    remoteHostDraft,
    remoteTokenDraft,
    runConnectivityCheck,
  ]);

  useEffect(() => {
    if (!isMobileRuntime || appSettingsLoading || busy) {
      return;
    }
    if (!isRemoteServerConfigured(appSettings)) {
      setMobileServerReady(false);
      setChecking(false);
      setStatusError(true);
      setStatusMessage(defaultMobileSetupMessage());
      return;
    }

    let active = true;
    setChecking(true);

    void (async () => {
      const ok = await runConnectivityCheck();
      if (active && !ok) {
        setStatusMessage((previous) => previous ?? "Unable to connect to remote backend.");
      }
      if (active) {
        setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    appSettings,
    appSettingsLoading,
    busy,
    isMobileRuntime,
    runConnectivityCheck,
  ]);

  const handleMobileConnectSuccess = useCallback(async () => {
    if (!isMobileRuntime) {
      return;
    }
    setStatusError(false);
    setStatusMessage(null);
    setMobileServerReady(true);
    try {
      await refreshWorkspaces();
    } catch {
      // Keep successful connectivity result even if local refresh fails.
    }
  }, [isMobileRuntime, refreshWorkspaces]);

  return {
    isMobileRuntime,
    showMobileSetupWizard: isMobileRuntime && !appSettingsLoading && !mobileServerReady,
    mobileSetupWizardProps: {
      remoteHostDraft,
      remoteTokenDraft,
      busy,
      checking,
      statusMessage,
      statusError,
      onRemoteHostChange: setRemoteHostDraft,
      onRemoteTokenChange: setRemoteTokenDraft,
      onConnectTest,
    },
    handleMobileConnectSuccess,
  };
}
