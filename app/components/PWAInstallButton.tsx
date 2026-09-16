"use client";

import { useEffect, useState } from "react";
import LumaIcon from "./LumaIcon";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setInstalled(Boolean(standalone));

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setHint("");
    };
    const installedHandler = () => {
      setInstalled(true);
      setPromptEvent(null);
      setHint("");
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function install() {
    if (installed) return;
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setHint(
      isIOS
        ? "Safari: Share → Add to Home Screen."
        : "Gunakan menu browser → Install app / Add to Home screen.",
    );
    window.setTimeout(() => setHint(""), 6500);
  }

  return (
    <div className={`pwa-install-wrap ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className="pwa-install-button"
        onClick={install}
        title={installed ? "Lumaway sudah terpasang" : "Install Lumaway sebagai aplikasi"}
      >
        <LumaIcon name="install" />
        {!compact && <span>{installed ? "App Installed" : "Install Lumaway"}</span>}
      </button>
      {hint && <div className="pwa-install-hint">{hint}</div>}
    </div>
  );
}
