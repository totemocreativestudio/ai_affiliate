"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase-browser";

type Check = {
  name: string;
  status: "PASS" | "FAIL" | "ERROR";
  detail: string;
};

const LUMA_PRODUCTION_WORKSPACE_ID = "d223d230-629a-41f5-8ff5-e219722340d3";

export default function RlsIsolationDiagnostic({
  currentWorkspaceId,
}: {
  currentWorkspaceId: string;
}) {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);

  async function run() {
    setRunning(true);
    const results: Check[] = [];

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      results.push({
        name: "Authenticated customer session",
        status: user ? "PASS" : "FAIL",
        detail: user ? `Authenticated as ${user.email ?? user.id}` : "No authenticated session",
      });

      results.push({
        name: "Customer workspace differs from Luma AI",
        status: currentWorkspaceId !== LUMA_PRODUCTION_WORKSPACE_ID ? "PASS" : "FAIL",
        detail:
          currentWorkspaceId !== LUMA_PRODUCTION_WORKSPACE_ID
            ? "Current workspace is isolated from the Luma AI production workspace."
            : "Current workspace unexpectedly equals the Luma AI production workspace.",
      });

      const { data: foreignWorkspace, error: foreignWorkspaceError } = await supabase
        .from("workspaces")
        .select("id,name")
        .eq("id", LUMA_PRODUCTION_WORKSPACE_ID);
      results.push({
        name: "Cannot read Luma AI workspace row",
        status: !foreignWorkspaceError && (foreignWorkspace?.length ?? 0) === 0 ? "PASS" : "FAIL",
        detail: foreignWorkspaceError
          ? `Query blocked/error: ${foreignWorkspaceError.message}`
          : `${foreignWorkspace?.length ?? 0} foreign workspace row(s) visible`,
      });

      const { data: foreignCreators, error: foreignCreatorsError } = await supabase
        .from("creators")
        .select("id")
        .eq("workspace_id", LUMA_PRODUCTION_WORKSPACE_ID)
        .limit(5);
      results.push({
        name: "Cannot read Luma AI creators",
        status: !foreignCreatorsError && (foreignCreators?.length ?? 0) === 0 ? "PASS" : "FAIL",
        detail: foreignCreatorsError
          ? `Query blocked/error: ${foreignCreatorsError.message}`
          : `${foreignCreators?.length ?? 0} foreign creator row(s) visible`,
      });

      const { data: foreignSales, error: foreignSalesError } = await supabase
        .from("sales")
        .select("id")
        .eq("workspace_id", LUMA_PRODUCTION_WORKSPACE_ID)
        .limit(5);
      results.push({
        name: "Cannot read Luma AI sales",
        status: !foreignSalesError && (foreignSales?.length ?? 0) === 0 ? "PASS" : "FAIL",
        detail: foreignSalesError
          ? `Query blocked/error: ${foreignSalesError.message}`
          : `${foreignSales?.length ?? 0} foreign sales row(s) visible`,
      });

      const { data: foreignProducts, error: foreignProductsError } = await supabase
        .from("product_master")
        .select("id")
        .eq("workspace_id", LUMA_PRODUCTION_WORKSPACE_ID)
        .limit(5);
      results.push({
        name: "Cannot read Luma AI product master",
        status: !foreignProductsError && (foreignProducts?.length ?? 0) === 0 ? "PASS" : "FAIL",
        detail: foreignProductsError
          ? `Query blocked/error: ${foreignProductsError.message}`
          : `${foreignProducts?.length ?? 0} foreign product row(s) visible`,
      });

      const { data: foreignKpi, error: foreignKpiError } = await supabase.rpc("get_dashboard_kpi", {
        p_workspace_id: LUMA_PRODUCTION_WORKSPACE_ID,
        p_start_date: "2026-06-01",
        p_end_date: "2026-08-31",
        p_platform: null,
        p_creator_id: null,
      });
      const kpiRows = Array.isArray(foreignKpi) ? foreignKpi.length : foreignKpi ? 1 : 0;
      results.push({
        name: "Dashboard RPC rejects foreign workspace",
        status: foreignKpiError || kpiRows === 0 ? "PASS" : "FAIL",
        detail: foreignKpiError
          ? `RPC rejected: ${foreignKpiError.message}`
          : `${kpiRows} foreign KPI result row(s) returned`,
      });
    } catch (error) {
      results.push({
        name: "Diagnostic execution",
        status: "ERROR",
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    setChecks(results);
    setRunning(false);
  }

  const allPassed = checks.length > 0 && checks.every((check) => check.status === "PASS");

  return (
    <section
      style={{
        marginTop: 28,
        padding: 18,
        border: "1px solid #d9d9d9",
        borderRadius: 10,
        background: "#fafafa",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Temporary RLS Isolation Diagnostic</h2>
      <p style={{ color: "#555" }}>
        Preview-only security test. It intentionally attempts to read the Luma AI production workspace using the currently authenticated browser session.
      </p>
      <button onClick={run} disabled={running} style={{ padding: "10px 16px", cursor: running ? "wait" : "pointer" }}>
        {running ? "Running..." : "Run isolation test"}
      </button>

      {checks.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>{allPassed ? "ALL CHECKS PASS" : "ISOLATION TEST NEEDS REVIEW"}</strong>
          {checks.map((check) => (
            <div key={check.name} style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e5e5" }}>
              <div><strong>{check.status}</strong> — {check.name}</div>
              <div style={{ color: "#666", marginTop: 4 }}>{check.detail}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
