"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-browser";
import ProductMaster from "./components/ProductMaster";
import Listings from "./components/Listings";
import Shipping from "./components/Shipping";
import CreatorSamples from "./components/CreatorSamples";

import RatecardMaster from "./components/RatecardMaster";
type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  active: boolean;
};

type Workspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type Creator = {
  id: number;
  creator_code: string | null;
  name: string | null;
  username: string | null;
  platform: string | null;
  status: string | null;
};

type KPI = {
  total_creators: number;
  total_sales_records: number;
  total_qty: number;
  total_orders: number;
  total_gmv: number;
  total_commission: number;
};

type CreatorRankingRow = {
  rank: number;
  creator_id: number;
  creator_code: string | null;
  creator_name: string | null;
  username: string | null;
  platform: string | null;
  qty: number;
  orders: number;
  gmv: number;
  commission: number;
  total_rows: number;
};

const DEFAULT_START_DATE = "2026-06-01";
const DEFAULT_END_DATE = "2026-08-31";

const CREATOR_RANKING_PAGE_SIZE = 50;

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(
    Number(value || 0)
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function Home() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const [creators, setCreators] = useState<Creator[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);

  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);

  const [platform, setPlatform] = useState("");
  const [creatorId, setCreatorId] = useState("");

  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [creatorsLoading, setCreatorsLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      await loadLumaData(session.user.id);
    }

    setLoading(false);
  }

  async function loadLumaData(userId: string) {
    setError("");

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,email,full_name,role,active")
        .eq("id", userId)
        .single();

    if (profileError) {
      setError(`Profile error: ${profileError.message}`);
      return;
    }

    setProfile(profileData);

    const { data: memberData, error: memberError } =
      await supabase
        .from("workspace_members")
        .select("workspace_id,membership_role")
        .eq("user_id", userId)
        .limit(1)
        .single();

    if (memberError) {
      setError(
        `Workspace membership error: ${memberError.message}`
      );
      return;
    }

    const { data: workspaceData, error: workspaceError } =
      await supabase
        .from("workspaces")
        .select("id,name,slug,status")
        .eq("id", memberData.workspace_id)
        .single();

    if (workspaceError) {
      setError(`Workspace error: ${workspaceError.message}`);
      return;
    }

    setWorkspace(workspaceData);

    await loadCreators(workspaceData.id);

    await loadKPI(
      workspaceData.id,
      DEFAULT_START_DATE,
      DEFAULT_END_DATE,
      "",
      ""
    );
  }

  async function loadCreators(workspaceId: string) {
    setCreatorsLoading(true);

    const { data, error: creatorsError } = await supabase
      .from("creators")
      .select(
        "id,creator_code,name,username,platform,status"
      )
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });

    if (creatorsError) {
      setError(
        `Creators error: ${creatorsError.message}`
      );
      setCreatorsLoading(false);
      return;
    }

    setCreators(data ?? []);
    setCreatorsLoading(false);
  }

  async function loadKPI(
    workspaceId: string,
    selectedStartDate: string,
    selectedEndDate: string,
    selectedPlatform: string,
    selectedCreatorId: string
  ) {
    setKpiLoading(true);
    setError("");

    const parsedCreatorId =
      selectedCreatorId === ""
        ? null
        : Number(selectedCreatorId);

    const { data, error: kpiError } =
      await supabase.rpc("get_dashboard_kpi", {
        p_workspace_id: workspaceId,
        p_start_date: selectedStartDate || null,
        p_end_date: selectedEndDate || null,
        p_platform: selectedPlatform || null,
        p_creator_id: parsedCreatorId,
      });

    if (kpiError) {
      setError(`KPI error: ${kpiError.message}`);
      setKpiLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setKpi({
        total_creators: 0,
        total_sales_records: 0,
        total_qty: 0,
        total_orders: 0,
        total_gmv: 0,
        total_commission: 0,
      });

      setKpiLoading(false);
      return;
    }

    setKpi(data[0]);
    setKpiLoading(false);
  }

  async function applyFilter() {
    if (!workspace) return;

    setError("");

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      setError(
        "Start Date tidak boleh lebih besar dari End Date."
      );
      return;
    }

    await loadKPI(
      workspace.id,
      startDate,
      endDate,
      platform,
      creatorId
    );
  }

  async function resetFilter() {
    if (!workspace) return;

    const resetStartDate = DEFAULT_START_DATE;
    const resetEndDate = DEFAULT_END_DATE;
    const resetPlatform = "";
    const resetCreatorId = "";

    setStartDate(resetStartDate);
    setEndDate(resetEndDate);
    setPlatform(resetPlatform);
    setCreatorId(resetCreatorId);

    await loadKPI(
      workspace.id,
      resetStartDate,
      resetEndDate,
      resetPlatform,
      resetCreatorId
    );
  }

  async function login() {
    setError("");
    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await loadLumaData(data.user.id);
    }

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();

    setProfile(null);
    setWorkspace(null);
    setCreators([]);
    setKpi(null);
  }

  if (loading) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>Luma AI</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main
        style={{
          maxWidth: 420,
          margin: "80px auto",
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>Luma AI</h1>
        <p>Supabase Authentication</p>

        <div style={{ marginTop: 30 }}>
          <label>
            <strong>Email</strong>
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            style={{
              width: "100%",
              padding: 12,
              marginTop: 8,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
          />

          <label>
            <strong>Password</strong>
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            style={{
              width: "100%",
              padding: 12,
              marginTop: 8,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={login}
            style={{
              width: "100%",
              padding: 12,
              cursor: "pointer",
            }}
          >
            Login
          </button>
        </div>

        {error && (
          <p
            style={{
              color: "red",
              marginTop: 20,
            }}
          >
            {error}
          </p>
        )}
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 30,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 5 }}>
            Luma AI Dashboard
          </h1>

          <p
            style={{
              marginTop: 0,
              color: "#666",
            }}
          >
            Production PostgreSQL
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "10px 18px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <hr />

      {/* ACCOUNT */}

      <section>
        <h2>Account</h2>

        <p>
          <strong>Email:</strong>{" "}
          {profile.email}
        </p>

        <p>
          <strong>Role:</strong>{" "}
          {profile.role}
        </p>

        <p>
          <strong>Active:</strong>{" "}
          {String(profile.active)}
        </p>
      </section>

      {/* WORKSPACE */}

      <section>
        <h2>Workspace</h2>

        <p>
          <strong>Name:</strong>{" "}
          {workspace?.name}
        </p>

        <p>
          <strong>Slug:</strong>{" "}
          {workspace?.slug}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          {workspace?.status}
        </p>
      </section>

      <hr />

      {/* FILTER */}

      <section>
        <h2>Dashboard KPI</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 15,
            alignItems: "end",
          }}
        >
          {/* START DATE */}

          <div>
            <label>
              <strong>Start Date</strong>
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(e.target.value)
              }
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* END DATE */}

          <div>
            <label>
              <strong>End Date</strong>
            </label>

            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                setEndDate(e.target.value)
              }
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* PLATFORM */}

          <div>
            <label>
              <strong>Platform</strong>
            </label>

            <select
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value)
              }
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
                boxSizing: "border-box",
              }}
            >
              <option value="">
                All Platforms
              </option>

              <option value="TikTok">
                TikTok
              </option>

              <option value="Shopee">
                Shopee
              </option>
            </select>
          </div>

          {/* CREATOR */}

          <div>
            <label>
              <strong>Creator</strong>
            </label>

            <select
              value={creatorId}
              onChange={(e) =>
                setCreatorId(e.target.value)
              }
              disabled={creatorsLoading}
              style={{
                width: "100%",
                padding: 10,
                marginTop: 6,
                boxSizing: "border-box",
              }}
            >
              <option value="">
                {creatorsLoading
                  ? "Loading creators..."
                  : "All Creators"}
              </option>

              {creators.map((creator) => (
                <option
                  key={creator.id}
                  value={creator.id}
                >
                  {creator.name ||
                    creator.username ||
                    creator.creator_code ||
                    `Creator ${creator.id}`}
                  {creator.platform
                    ? ` — ${creator.platform}`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BUTTONS */}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            onClick={applyFilter}
            disabled={kpiLoading}
            style={{
              padding: "11px 22px",
              cursor: kpiLoading
                ? "wait"
                : "pointer",
            }}
          >
            {kpiLoading
              ? "Loading..."
              : "Apply Filter"}
          </button>

          <button
            onClick={resetFilter}
            disabled={kpiLoading}
            style={{
              padding: "11px 22px",
              cursor: kpiLoading
                ? "wait"
                : "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </section>

      <hr />

      {/* KPI */}

      <section>
        {kpiLoading ? (
          <p>Loading KPI...</p>
        ) : kpi ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 15,
              }}
            >
              <KpiCard
                title="Creators"
                value={formatNumber(
                  kpi.total_creators
                )}
              />

              <KpiCard
                title="Sales Records"
                value={formatNumber(
                  kpi.total_sales_records
                )}
              />

              <KpiCard
                title="Total Qty"
                value={formatNumber(
                  kpi.total_qty
                )}
              />

              <KpiCard
                title="Total Orders"
                value={formatNumber(
                  kpi.total_orders
                )}
              />

              <KpiCard
                title="Total GMV"
                value={formatCurrency(
                  kpi.total_gmv
                )}
              />

              <KpiCard
                title="Commission"
                value={formatCurrency(
                  kpi.total_commission
                )}
              />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 15,
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 14,
                color: "#555",
              }}
            >
              <strong>
                Active Filter:
              </strong>{" "}
              {startDate || "All"} →{" "}
              {endDate || "All"}
              {" | "}
              Platform:{" "}
              {platform || "All"}
              {" | "}
              Creator:{" "}
              {creatorId
                ? creators.find(
                    (c) =>
                      String(c.id) ===
                      creatorId
                  )?.name ||
                  creators.find(
                    (c) =>
                      String(c.id) ===
                      creatorId
                  )?.username ||
                  `ID ${creatorId}`
                : "All"}
            </div>
          </>
        ) : (
          <p>No KPI data.</p>
        )}
      </section>

      {/* ================================================== */}
      {/* RANKING CREATOR */}
      {/* ================================================== */}

      {workspace && (
        <CreatorRanking
          workspaceId={workspace.id}
          startDate={startDate}
          endDate={endDate}
          platform={platform}
          creatorId={creatorId}
        />
      )}

      {workspace && <ProductMaster workspaceId={workspace.id} />}

        {workspace && <Listings workspaceId={workspace.id} />}

        {workspace && <Shipping workspaceId={workspace.id} />}

        {workspace && <CreatorSamples workspaceId={workspace.id} />}

        {/* ERROR */}

      {error && (
        <p
          style={{
            color: "red",
            marginTop: 25,
            padding: 15,
            border: "1px solid red",
            borderRadius: 6,
          }}
        >
          {error}
        </p>
      )}
            {workspace && <RatecardMaster workspaceId={workspace.id} />}
</main>
  );
}

/* ========================================================== */
/* KPI CARD */
/* ========================================================== */

function KpiCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 20,
        minHeight: 100,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: "#666",
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ========================================================== */
/* CREATOR RANKING */
/* ========================================================== */

function CreatorRanking({
  workspaceId,
  startDate,
  endDate,
  platform,
  creatorId,
}: {
  workspaceId: string;
  startDate: string;
  endDate: string;
  platform: string;
  creatorId: string;
}) {
  const supabase = createClient();

  const [rows, setRows] = useState<
    CreatorRankingRow[]
  >([]);

  const [page, setPage] = useState(1);

  const [totalRows, setTotalRows] =
    useState(0);

  const [search, setSearch] =
    useState("");

  const [appliedSearch, setAppliedSearch] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [rankingError, setRankingError] =
    useState("");

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalRows /
        CREATOR_RANKING_PAGE_SIZE
    )
  );

  useEffect(() => {
    setPage(1);
  }, [
    workspaceId,
    startDate,
    endDate,
    platform,
    creatorId,
  ]);

  useEffect(() => {
    loadRanking();
  }, [
    workspaceId,
    startDate,
    endDate,
    platform,
    creatorId,
    page,
    appliedSearch,
  ]);

  async function loadRanking() {
    if (!workspaceId) return;

    setLoading(true);
    setRankingError("");

    const parsedCreatorId =
      creatorId === ""
        ? null
        : Number(creatorId);

    const { data, error } =
      await supabase.rpc(
        "get_creator_ranking",
        {
          p_workspace_id:
            workspaceId,

          p_start_date:
            startDate || null,

          p_end_date:
            endDate || null,

          p_platform:
            platform || null,

          p_creator_id:
            parsedCreatorId,

          p_search:
            appliedSearch || null,

          p_page: page,

          p_page_size:
            CREATOR_RANKING_PAGE_SIZE,
        }
      );

    if (error) {
      setRankingError(
        `Ranking Creator error: ${error.message}`
      );

      setRows([]);
      setTotalRows(0);
      setLoading(false);

      return;
    }

    const result =
      (data ?? []) as CreatorRankingRow[];

    setRows(result);

    if (result.length > 0) {
      setTotalRows(
        Number(
          result[0].total_rows || 0
        )
      );
    } else {
      setTotalRows(0);
    }

    setLoading(false);
  }

  function applySearch() {
    setPage(1);
    setAppliedSearch(
      search.trim()
    );
  }

  function resetSearch() {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }

  function goToPage(
    targetPage: number
  ) {
    if (targetPage < 1) return;

    if (
      targetPage > totalPages
    ) {
      return;
    }

    setPage(targetPage);
  }

  const startRow =
    totalRows === 0
      ? 0
      : (page - 1) *
          CREATOR_RANKING_PAGE_SIZE +
        1;

  const endRow =
    totalRows === 0
      ? 0
      : Math.min(
          page *
            CREATOR_RANKING_PAGE_SIZE,
          totalRows
        );

  return (
    <section
      style={{
        marginTop: 40,
      }}
    >
      <hr />

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2>
            Ranking Creator
          </h2>

          <p
            style={{
              color: "#666",
              marginTop: 5,
            }}
          >
            Ranking berdasarkan GMV
          </p>
        </div>

        <div
          style={{
            fontSize: 14,
            color: "#666",
          }}
        >
          {totalRows > 0
            ? `${formatNumber(
                startRow
              )}–${formatNumber(
                endRow
              )} dari ${formatNumber(
                totalRows
              )} creator`
            : "Tidak ada data"}
        </div>
      </div>

      {/* SEARCH */}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 20,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Cari creator, username, atau code..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          onKeyDown={(e) => {
            if (
              e.key === "Enter"
            ) {
              applySearch();
            }
          }}
          style={{
            flex:
              "1 1 350px",
            minWidth: 250,
            padding: 10,
            boxSizing:
              "border-box",
          }}
        />

        <button
          onClick={applySearch}
          disabled={loading}
          style={{
            padding:
              "10px 18px",
            cursor: loading
              ? "wait"
              : "pointer",
          }}
        >
          Search
        </button>

        <button
          onClick={resetSearch}
          disabled={
            loading &&
            !appliedSearch
          }
          style={{
            padding:
              "10px 18px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      {/* TABLE */}

      <div
        style={{
          marginTop: 20,
          overflowX: "auto",
          border:
            "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 30,
              textAlign:
                "center",
            }}
          >
            Loading ranking
            creator...
          </div>
        ) : rows.length ===
          0 ? (
          <div
            style={{
              padding: 30,
              textAlign:
                "center",
              color: "#666",
            }}
          >
            Tidak ada data creator
            untuk filter ini.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              minWidth: 950,
            }}
          >
            <thead>
              <tr>
                {[
                  "Rank",
                  "Creator",
                  "Username",
                  "Platform",
                  "Qty",
                  "Orders",
                  "GMV",
                  "Commission",
                ].map(
                  (header) => (
                    <th
                      key={header}
                      style={{
                        padding: 12,
                        textAlign:
                          header ===
                            "Rank" ||
                          header ===
                            "Qty" ||
                          header ===
                            "Orders"
                            ? "right"
                            : "left",
                        borderBottom:
                          "1px solid #ddd",
                        background:
                          "#f7f7f7",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (row) => (
                  <tr
                    key={
                      row.creator_id
                    }
                  >
                    <td
                      style={{
                        padding: 12,
                        textAlign:
                          "right",
                        borderBottom:
                          "1px solid #eee",
                        fontWeight: 700,
                      }}
                    >
                      {formatNumber(
                        row.rank
                      )}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        borderBottom:
                          "1px solid #eee",
                      }}
                    >
                      <div
                        style={{
                          fontWeight:
                            600,
                        }}
                      >
                        {row.creator_name ||
                          "-"}
                      </div>

                      {row.creator_code && (
                        <div
                          style={{
                            fontSize: 12,
                            color:
                              "#777",
                            marginTop:
                              3,
                          }}
                        >
                          {
                            row.creator_code
                          }
                        </div>
                      )}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        borderBottom:
                          "1px solid #eee",
                      }}
                    >
                      {row.username ||
                        "-"}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        borderBottom:
                          "1px solid #eee",
                      }}
                    >
                      {row.platform ||
                        "-"}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        textAlign:
                          "right",
                        borderBottom:
                          "1px solid #eee",
                      }}
                    >
                      {formatNumber(
                        row.qty
                      )}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        textAlign:
                          "right",
                        borderBottom:
                          "1px solid #eee",
                      }}
                    >
                      {formatNumber(
                        row.orders
                      )}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        textAlign:
                          "right",
                        borderBottom:
                          "1px solid #eee",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {formatCurrency(
                        row.gmv
                      )}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        textAlign:
                          "right",
                        borderBottom:
                          "1px solid #eee",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {formatCurrency(
                        row.commission
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINATION */}

      {totalRows > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 15,
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#666",
            }}
          >
            Page{" "}
            {formatNumber(page)}
            {" "}dari{" "}
            {formatNumber(
              totalPages
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() =>
                goToPage(
                  page - 1
                )
              }
              disabled={
                page === 1 ||
                loading
              }
              style={{
                padding:
                  "8px 12px",
                cursor:
                  page === 1 ||
                  loading
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Previous
            </button>

            {Array.from(
              {
                length:
                  Math.min(
                    totalPages,
                    7
                  ),
              },
              (_, index) => {
                let pageNumber =
                  index + 1;

                if (
                  totalPages > 7 &&
                  page > 4
                ) {
                  pageNumber =
                    page -
                    3 +
                    index;

                  if (
                    pageNumber >
                    totalPages
                  ) {
                    pageNumber =
                      totalPages -
                      6 +
                      index;
                  }
                }

                return (
                  <button
                    key={
                      pageNumber
                    }
                    onClick={() =>
                      goToPage(
                        pageNumber
                      )
                    }
                    disabled={
                      loading
                    }
                    style={{
                      padding:
                        "8px 12px",
                      cursor:
                        "pointer",
                      fontWeight:
                        pageNumber ===
                        page
                          ? 700
                          : 400,
                    }}
                  >
                    {
                      pageNumber
                    }
                  </button>
                );
              }
            )}

            <button
              onClick={() =>
                goToPage(
                  page + 1
                )
              }
              disabled={
                page >=
                  totalPages ||
                loading
              }
              style={{
                padding:
                  "8px 12px",
                cursor:
                  page >=
                    totalPages ||
                  loading
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {rankingError && (
        <p
          style={{
            color: "red",
            marginTop: 20,
            padding: 15,
            border:
              "1px solid red",
            borderRadius: 6,
          }}
        >
          {rankingError}
        </p>
      )}

      <div
        style={{
          marginTop: 15,
          fontSize: 13,
          color: "#777",
        }}
      >
        Filter aktif:{" "}
        {startDate || "All"} →{" "}
        {endDate || "All"}
        {" | "}
        Platform:{" "}
        {platform || "All"}
      </div>
    </section>
  );
}


