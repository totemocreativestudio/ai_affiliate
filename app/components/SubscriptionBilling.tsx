"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type Row = Record<string, any>;
const money = (v: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
const date = (v: any) =>
  v ? new Date(v).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";

export default function SubscriptionBilling({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [plans, setPlans] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [promo, setPromo] = useState("");
  const [promoInfo, setPromoInfo] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    const [p, s, o] = await Promise.all([
      supabase.from("luma_subscription_plans").select("*").eq("status", "active").order("sort_order"),
      supabase
        .from("luma_user_subscriptions")
        .select("*,luma_subscription_plans(*)")
        .eq("user_id", userId)
        .order("ends_at", { ascending: false }),
      supabase
        .from("luma_subscription_orders")
        .select("*,luma_subscription_plans(name,code)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setPlans((p.data || []) as Row[]);
    setSubs((s.data || []) as Row[]);
    setOrders((o.data || []) as Row[]);
  }

  useEffect(() => {
    void load();
    const saved = localStorage.getItem("lumaway_promo_code");
    if (saved) setPromo(saved);
  }, [workspaceId, userId]);

  const current = subs.find((item) => item.ends_at && new Date(item.ends_at).getTime() > Date.now()) || subs[0];
  const currentPlan = current?.luma_subscription_plans || {};
  const expired = current?.ends_at && new Date(current.ends_at).getTime() <= Date.now();

  function upgradePreview(target: Row) {
    if (!current || !currentPlan || currentPlan.is_trial || expired) return null;
    if (String(current.status).toLowerCase() !== "active") return null;
    if (Number(target.sort_order || 0) <= Number(currentPlan.sort_order || 0)) return null;
    if (Number(target.price || 0) <= Number(currentPlan.price || 0)) return null;

    const remainingDays = Math.max(0, (new Date(current.ends_at).getTime() - Date.now()) / 86_400_000);
    const dailyValue = Number(currentPlan.price || 0) / Math.max(1, Number(currentPlan.duration_days || 1));
    const credit = Math.min(Number(target.price || 0), Math.max(0, Math.round(dailyValue * remainingDays)));
    return {
      remainingDays,
      credit,
      payable: Math.max(0, Number(target.price || 0) - credit),
    };
  }

  async function checkPromo() {
    try {
      const r = await fetch("/api/promos/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, code: promo, target_type: "generic" }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error();
      setPromoInfo(d);
      localStorage.setItem("lumaway_promo_code", promo.trim().toUpperCase());
      window.dispatchEvent(
        new CustomEvent("lumaway-promo-code", { detail: { code: promo.trim().toUpperCase() } }),
      );
      setMsg(`Kode ${d.promo.code} aktif · ${d.promo.title}`);
    } catch {
      setPromoInfo(null);
      setMsg("Kode promo tidak dapat digunakan.");
    }
  }

  async function claim() {
    try {
      const r = await fetch("/api/promos/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, code: promo }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error();
      setMsg(
        d.kind === "free_tokens"
          ? `${d.bonus_tokens} token bonus berhasil ditambahkan.`
          : `Masa aktif bertambah ${d.extend_days} hari.`,
      );
      window.dispatchEvent(new Event("luma-token-updated"));
      await load();
    } catch {
      setMsg("Kode promo tidak dapat digunakan.");
    }
  }

  async function checkout(plan: Row) {
    setBusy(plan.id);
    setMsg("");
    try {
      const applicable =
        promoInfo && ["subscription_percent", "subscription_amount"].includes(promoInfo.promo?.promo_type)
          ? promo.trim()
          : "";
      const r = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, plan_id: plan.id, promo_code: applicable }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error();

      const pricing = d.pricing;
      if (d.free) {
        setMsg(
          pricing?.upgrade
            ? `Upgrade berhasil. Kredit sisa paket ${money(pricing.upgrade_credit_amount)} telah digunakan.`
            : "Langganan berhasil diaktifkan dengan promo.",
        );
        await load();
        return;
      }

      if (pricing?.upgrade) {
        setMsg(
          `Upgrade dibuat: ${pricing.upgrade.remaining_days.toFixed(1)} hari tersisa dikonversi menjadi kredit ${money(pricing.upgrade_credit_amount)}. Total bayar ${money(pricing.amount)}.`,
        );
      } else {
        setMsg("Checkout langganan dibuat dan berlaku 3 hari.");
      }
      if (d.payment_url) window.location.href = d.payment_url;
    } catch {
      setMsg("error, terjadi kesalahan.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="subscription-zone">
      <div className="subscription-current card">
        <div>
          <span className="subscription-kicker">CURRENT SUBSCRIPTION</span>
          <h3>{currentPlan.name || "Lumaway"}</h3>
          <p>
            {expired ? "Expired" : current?.status || "-"} · Priority <b>{current?.priority_level || "trial"}</b>
          </p>
        </div>
        <div className="subscription-expiry">
          <small>Active until</small>
          <strong>{date(current?.ends_at)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="section-head">
          <div>
            <h3>Paket Langganan Lumaway</h3>
            <p className="muted">
              Upgrade dari paket 1 bulan ke 6 bulan otomatis mengubah sisa hari menjadi kredit rupiah. Sisa hari lama tidak dihitung dua kali.
            </p>
          </div>
        </div>
        <div className="subscription-plan-grid">
          {plans.map((plan) => {
            const upgrade = upgradePreview(plan);
            const isCurrent = Number(current?.plan_id) === Number(plan.id) && !expired;
            return (
              <article
                className={`subscription-plan ${plan.is_trial ? "trial" : ""} ${isCurrent ? "current-plan" : ""} ${upgrade ? "upgrade-plan" : ""}`}
                key={plan.id}
              >
                <span>{plan.name}</span>
                <b>{plan.is_trial ? "Gratis" : money(plan.price)}</b>
                <small>{plan.duration_days} hari · Semua fitur</small>
                <em>{plan.bonus_tokens ? `+${plan.bonus_tokens} token bonus` : "Full access"}</em>
                <i>Priority {plan.priority_level}</i>
                {isCurrent && <div className="plan-current-badge">Paket aktif</div>}
                {upgrade && (
                  <div className="upgrade-credit-box">
                    <span>Upgrade credit</span>
                    <strong>-{money(upgrade.credit)}</strong>
                    <small>{upgrade.remainingDays.toFixed(1)} hari tersisa dikonversi</small>
                    <b>Total estimasi {money(upgrade.payable)}</b>
                  </div>
                )}
                {!plan.is_trial && (
                  <button
                    className="primary"
                    disabled={busy === plan.id || isCurrent}
                    onClick={() => checkout(plan)}
                  >
                    {busy === plan.id ? "Preparing..." : upgrade ? "Upgrade ke 6 Bulan" : isCurrent ? "Aktif" : "Pilih Paket"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <div className="card promo-claim-card">
        <div>
          <h3>Promo & Voucher</h3>
          <p className="muted">
            Kode dapat memberi diskon langganan, diskon token, bonus token, atau tambahan masa aktif. Pada upgrade, promo dihitung setelah kredit sisa paket.
          </p>
        </div>
        <div className="promo-code-row">
          <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Masukkan kode promo" />
          <button onClick={checkPromo}>Cek Kode</button>
          {promoInfo && ["free_tokens", "extend_days"].includes(promoInfo.promo?.promo_type) && (
            <button className="primary" onClick={claim}>
              Klaim
            </button>
          )}
        </div>
        {promoInfo && (
          <div className="promo-preview">
            <b>{promoInfo.promo.code}</b>
            <span>{promoInfo.promo.title}</span>
            <small>{promoInfo.promo.promo_type.replaceAll("_", " ")}</small>
          </div>
        )}
        {msg && <div className="owner-inline-note">{msg}</div>}
      </div>

      {orders.length > 0 && (
        <div className="card">
          <h3>Riwayat Langganan</h3>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Plan</th>
                  <th>Base</th>
                  <th>Upgrade Credit</th>
                  <th>Promo</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Valid Until</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.order_code}</td>
                    <td>{o.luma_subscription_plans?.name || "-"}</td>
                    <td>{money(o.base_amount)}</td>
                    <td>{Number(o.upgrade_credit_amount || 0) > 0 ? `-${money(o.upgrade_credit_amount)}` : "-"}</td>
                    <td>{Number(o.discount_amount || 0) > 0 ? `-${money(o.discount_amount)}` : "-"}</td>
                    <td>{money(o.amount)}</td>
                    <td>
                      <span className={`status-pill s-${String(o.status).toLowerCase()}`}>{o.status}</span>
                    </td>
                    <td>{date(o.expires_at)}</td>
                    <td>{date(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
