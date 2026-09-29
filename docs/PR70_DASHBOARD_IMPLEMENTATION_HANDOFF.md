# Lumaway Dashboard Handoff — PR #70 reference

> PR #70 is already merged. This document is the reusable Cursor / GitHub Copilot prompt and implementation contract for future dashboard patches without regressing the data fixes from PR #69–#70.

## Paste-ready implementation prompt

```text
You are updating the production Lumaway dashboard.

Do not replace real Supabase data with mock data.
Do not merge Affiliate Performance and Product Performance sources.
Do not loosen workspace RLS.
Do not globally lock users based on another user's subscription.

Keep these production behaviors:
- KPI source: get_dashboard_metrics_v5
- creator ranking: get_creator_ranking_v2
- creator summary: get_creator_ranking_summary_v2
- product ranking: get_product_ranking_v2
- daily trend: get_dashboard_daily_trend_v2
- platform contribution: get_dashboard_platform_mix_v2
- per-user access state: luma_my_access_state_v1

UI requirements:
- KPI cards use clean flat SaaS cards: small label, strong number, compact positive/negative badge, optional previous-period detail.
- If previous period has no data, show "Belum ada baseline" instead of +100%.
- Trend Performance must be a real time-series chart for the selected metric and active date range.
- Metric selector: GMV, Orders, Qty Paid, Komisi Creator, Refund GMV, Creator Aktif, LIVE, Video.
- A one-day range stays a chart with one real point. Never fabricate extra points.
- Platform contribution metric selector: GMV, Orders, Qty Paid, Komisi, Refund GMV.
- One platform: show total + 100% contribution bar, not a giant redundant donut.
- Multiple platforms: compact donut plus ranked contribution bars.
- Creator module failure must not blank Product Ranking, KPI, trend, or other modules.
- Use functional neutral iconography only. Avoid sparkles, magic wand, robot, neural-network, and decorative AI glyphs.
- Responsive desktop/tablet/mobile.
```

## KPI card contract

Current production implementation lives in `app/components/LegacyDashboard.tsx`.

Expected behavior:

```tsx
function KpiCard({label,value,previous,kind}:{
  label:string;
  value:any;
  previous:any;
  kind:"money"|"number"|"ratio";
}){
  const hasComparison=previous!==undefined;
  const d=hasComparison?delta(value,previous):null;
  const rendered=kind==="money"
    ? money(value)
    : kind==="ratio"
      ? `${Number(value||0).toFixed(2)}x`
      : number(value);

  return (
    <div className="dashboard-kpi-card">
      <small>{label}</small>
      <b>{rendered}</b>
      {hasComparison && (
        d===null
          ? <span className="kpi-delta baseline-missing">Data baru · tanpa baseline</span>
          : <span className={`kpi-delta ${d>0?"up":d<0?"down":"flat"}`}>
              {d>0?"↑":d<0?"↓":"→"} {Math.abs(d).toFixed(1)}% <i>vs prev.</i>
            </span>
      )}
    </div>
  );
}
```

Never treat `previous = 0` as an automatic +100% comparison.

## Safe Creator Ranking contract

Creator ranking must be workspace scoped and sourced only from Affiliate Performance / sales rows.

Rules:
- `data_type in ('performance','sales')`
- authenticated user must belong to `p_workspace_id`, unless Lumaway admin
- aggregate by creator
- LEFT JOIN creator master so missing master rows do not hide performance rows
- creator display fallback: master name -> sales creator_name -> sales username
- Product Performance must never enter this ranking
- pagination count must come from the full filtered result

Production RPC: `public.get_creator_ranking_v2`.

## Empty and warning states

Use isolated module degradation.

```tsx
{dataWarnings.length>0 && (
  <div className="dashboard-data-warning">
    <strong>Sebagian data sedang dipulihkan.</strong>
    <span>{dataWarnings.join(" ")}</span>
  </div>
)}

{!ranking.length && (
  <div className="empty-state">
    <strong>Belum ada Creator Performance untuk periode ini.</strong>
    <span>Periksa periode, platform, toko, atau data Affiliate Performance yang diupload.</span>
  </div>
)}
```

One failed secondary RPC must not call a global `clearDashboardData()`.

## Required SQL / RPC checks

Before releasing a dashboard change, verify:

```sql
-- user can only access their workspace
select count(*) from public.sales where workspace_id = :workspace_id;

-- creator ranking returns real rows
select * from public.get_creator_ranking_v2(
  :workspace_id, :start_date, :end_date, null, null, null, null, 1, 50
);

-- trend is daily, not a single aggregate
select * from public.get_dashboard_daily_trend_v2(
  :workspace_id, :start_date, :end_date, null, null
);

-- platform GMV reconciles to dashboard GMV
select
  (select coalesce(sum(gmv),0)
   from public.get_dashboard_platform_mix_v2(:workspace_id,:start_date,:end_date,null,null)) as platform_gmv,
  (select total_gmv
   from public.get_dashboard_metrics_v5(:workspace_id,:start_date,:end_date,null,null)) as dashboard_gmv;
```

Release only when workspace isolation, TypeScript, production build, and route smoke tests pass.
