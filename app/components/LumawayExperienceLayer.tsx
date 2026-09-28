"use client";

import { useEffect, useRef, useState } from "react";

type ConnectionState = "online" | "offline" | "reconnecting" | "slow";

export default function LumawayExperienceLayer() {
  const [connection, setConnection] = useState<ConnectionState>("online");
  const [routeLoading, setRouteLoading] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const routeTimer = useRef<number | null>(null);

  useEffect(() => {
    const detectConnection = () => {
      if (!navigator.onLine) {
        setConnection("offline");
        return;
      }
      const network = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
      if (network?.saveData || network?.effectiveType === "2g" || network?.effectiveType === "slow-2g") {
        setConnection("slow");
        return;
      }
      setConnection("online");
    };

    const onOffline = () => setConnection("offline");
    const onOnline = () => {
      setConnection("reconnecting");
      window.setTimeout(() => {
        setConnection("online");
        setShowBackOnline(true);
        window.setTimeout(() => setShowBackOnline(false), 3200);
      }, 650);
    };

    const onRouteChange = () => {
      setRouteLoading(true);
      if (routeTimer.current) window.clearTimeout(routeTimer.current);
      routeTimer.current = window.setTimeout(() => setRouteLoading(false), 520);
    };

    detectConnection();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("lumaway-routechange", onRouteChange as EventListener);
    const network = (navigator as Navigator & { connection?: EventTarget }).connection;
    network?.addEventListener?.("change", detectConnection);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("lumaway-routechange", onRouteChange as EventListener);
      network?.removeEventListener?.("change", detectConnection);
      if (routeTimer.current) window.clearTimeout(routeTimer.current);
    };
  }, []);

  return (
    <>
      <div className={`lumaway-route-progress ${routeLoading ? "is-active" : ""}`} aria-hidden="true"><span /></div>
      {connection !== "online" && (
        <div className={`lumaway-connection-banner state-${connection}`} role="status" aria-live="polite">
          <div>
            <strong>
              {connection === "offline" ? "Anda sedang offline" : connection === "reconnecting" ? "Menghubungkan kembali..." : "Koneksi sedang lambat"}
            </strong>
            <span>
              {connection === "offline"
                ? "Data terakhir yang sudah dimuat tetap bisa dilihat. Lumaway akan tersambung kembali secara otomatis."
                : connection === "reconnecting"
                  ? "Koneksi sudah kembali. Data sedang disinkronkan."
                  : "Lumaway mengurangi animasi dan pemuatan berat agar workspace tetap responsif."}
            </span>
          </div>
        </div>
      )}
      {showBackOnline && <div className="lumaway-back-online" role="status">Tersambung kembali · data sedang diperbarui</div>}
    </>
  );
}
