"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-browser";
import LumaIcon from "./LumaIcon";

type NotificationRow = {
  key: string;
  source: "broadcast" | "direct";
  id: number;
  title: string;
  body: string;
  category: string;
  action_url: string | null;
  action_label: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  read: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  ai_generate: "AI",
  document_generated: "AI Document",
  document_preview: "AI Document",
  document_download: "AI Document",
  token_usage: "Token",
  token_topup: "Token",
  payment_pending: "Payment",
  payment_success: "Payment",
  payment_failed: "Payment",
  payment_expired: "Payment",
  payment_status: "Payment",
  upload_success: "Data Upload",
  referral_reward: "Referral",
  withdrawal_pending: "Payout",
  withdrawal_completed: "Payout",
  withdrawal_failed: "Payout",
  withdrawal_status: "Payout",
  ticket_created: "Support",
  ticket_status: "Support",
  ticket_reply: "Support",
  social_like: "Social",
  kanban_done: "Kanban",
  maintenance: "System",
  system_update: "System",
  promotion: "Promotion",
  education: "Education",
  info: "Information",
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category.replaceAll("_", " ");
}

export default function NotificationCenter({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationRow | null>(null);
  const firstLoad = useRef(true);

  async function load() {
    const [globalRes, directRes] = await Promise.all([
      supabase
        .from("luma_notifications")
        .select("id,title,body,category,action_url,action_label,image_url,published_at,created_at")
        .order("published_at", { ascending: false })
        .limit(40),
      supabase
        .from("user_notifications")
        .select("id,title,message,kind,is_read,action_url,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    const globals = (globalRes.data || []) as any[];
    const ids = globals.map((item) => item.id);
    let readIds = new Set<number>();

    if (ids.length) {
      const { data: readRows } = await supabase
        .from("luma_notification_reads")
        .select("notification_id")
        .eq("user_id", userId)
        .in("notification_id", ids);
      readIds = new Set((readRows || []).map((item: any) => Number(item.notification_id)));
    }

    const globalRows: NotificationRow[] = globals.map((item) => ({
      key: `g-${item.id}`,
      source: "broadcast",
      id: Number(item.id),
      title: item.title || "Informasi Lumaway",
      body: item.body || "",
      category: item.category || "info",
      action_url: item.action_url || null,
      action_label: item.action_label || null,
      image_url: item.image_url || null,
      published_at: item.published_at || item.created_at,
      created_at: item.created_at,
      read: readIds.has(Number(item.id)),
    }));

    const directRows: NotificationRow[] = (directRes.data || []).map((item: any) => ({
      key: `d-${item.id}`,
      source: "direct",
      id: Number(item.id),
      title: item.title || "Informasi Lumaway",
      body: item.message || "",
      category: item.kind || "info",
      action_url: item.action_url || null,
      action_label: null,
      image_url: null,
      published_at: item.created_at,
      created_at: item.created_at,
      read: Boolean(item.is_read),
    }));

    const list = [...globalRows, ...directRows]
      .sort(
        (a, b) =>
          new Date(b.published_at || b.created_at).getTime() -
          new Date(a.published_at || a.created_at).getTime(),
      )
      .slice(0, 80);

    if (!firstLoad.current) {
      const fresh = list.find((item) => !item.read && !rows.some((old) => old.key === item.key));
      if (fresh) {
        setToast(fresh);
        window.setTimeout(() => setToast(null), 7000);
      }
    }

    firstLoad.current = false;
    setRows(list);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // load intentionally refreshes current workspace/user notifications.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, userId]);

  const unread = useMemo(() => rows.filter((item) => !item.read).length, [rows]);

  async function markRead(row: NotificationRow, clicked = false) {
    if (row.source === "broadcast") {
      await supabase.from("luma_notification_reads").upsert(
        {
          notification_id: row.id,
          user_id: userId,
          read_at: new Date().toISOString(),
          clicked_at: clicked ? new Date().toISOString() : null,
        },
        { onConflict: "notification_id,user_id" },
      );
    } else {
      await supabase.from("user_notifications").update({ is_read: true }).eq("id", row.id).eq("user_id", userId);
    }

    setRows((previous) => previous.map((item) => (item.key === row.key ? { ...item, read: true } : item)));

    if (clicked && row.action_url) {
      setOpen(false);
      if (row.action_url.startsWith("#")) window.location.hash = row.action_url.slice(1);
      else window.location.assign(row.action_url);
    }
  }

  async function markAll() {
    const broadcast = rows.filter((item) => !item.read && item.source === "broadcast");
    const direct = rows.filter((item) => !item.read && item.source === "direct");

    if (broadcast.length) {
      await supabase.from("luma_notification_reads").upsert(
        broadcast.map((item) => ({ notification_id: item.id, user_id: userId, read_at: new Date().toISOString() })),
        { onConflict: "notification_id,user_id" },
      );
    }

    if (direct.length) {
      await supabase
        .from("user_notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .in("id", direct.map((item) => item.id));
    }

    setRows((previous) => previous.map((item) => ({ ...item, read: true })));
  }

  return (
    <div className="notification-root">
      <button className="notification-bell" aria-label="Notifications" onClick={() => setOpen((value) => !value)}>
        <LumaIcon name="bell" />
        {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
      </button>

      {open && (
        <div className="notification-popover">
          <div className="notification-head">
            <div>
              <strong>Notifications</strong>
              <span>{unread} belum dibaca</span>
            </div>
            <button onClick={() => void markAll()}>Mark all read</button>
          </div>
          <div className="notification-list">
            {rows.length ? (
              rows.map((row) => (
                <button
                  key={row.key}
                  className={`notification-item ${row.read ? "read" : "unread"}`}
                  onClick={() => void markRead(row, true)}
                >
                  {row.image_url && <img src={row.image_url} alt="" />}
                  <div>
                    <span className={`notification-category n-${row.category}`}>{categoryLabel(row.category)}</span>
                    <strong>{row.title}</strong>
                    <p>{row.body}</p>
                    <small>
                      {row.published_at ? new Date(row.published_at).toLocaleString("id-ID") : ""}
                      {row.action_label ? ` · ${row.action_label}` : ""}
                    </small>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty-state"><strong>Belum ada notifikasi.</strong></div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <button className="notification-toast" onClick={() => void markRead(toast, true)}>
          <span className={`notification-category n-${toast.category}`}>{categoryLabel(toast.category)}</span>
          <strong>{toast.title}</strong>
          <p>{toast.body}</p>
        </button>
      )}
    </div>
  );
}
