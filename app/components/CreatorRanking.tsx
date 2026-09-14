"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

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

type Props = {
  workspaceId: string;
  startDate: string;
  endDate: string;
  platform: string;
  creatorId: string;
};

const PAGE_SIZE = 50;

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

export default function CreatorRanking({
  workspaceId,
  startDate,
  endDate,
  platform,
  creatorId,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const requestIdRef = useRef(0);

  const [rows, setRows] = useState<CreatorRankingRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalPages = Math.max(
    1,
    Math.ceil(totalRows / PAGE_SIZE)
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
    if (!workspaceId) {
      setRows([]);
      setTotalRows(0);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    let disposed = false;

    async function loadRanking() {
      setLoading(true);
      setError("");

      const parsedCreatorId =
        creatorId === "" ? null : Number(creatorId);

      try {
        const { data, error: rankingError } =
          await supabase.rpc("get_creator_ranking", {
            p_workspace_id: workspaceId,
            p_start_date: startDate || null,
            p_end_date: endDate || null,
            p_platform: platform || null,
            p_creator_id: parsedCreatorId,
            p_search: appliedSearch || null,
            p_page: page,
            p_page_size: PAGE_SIZE,
          });

        // Ignore stale responses from an older filter/page request.
        if (disposed || requestId !== requestIdRef.current) return;

        if (rankingError) {
          setError(
            `Ranking Creator error: ${rankingError.message}`
          );
          setRows([]);
          setTotalRows(0);
          return;
        }

        const result = (data ?? []) as CreatorRankingRow[];
        setRows(result);
        setTotalRows(
          result.length > 0
            ? Number(result[0].total_rows || 0)
            : 0
        );
      } catch (err) {
        if (disposed || requestId !== requestIdRef.current) return;

        setError(
          `Ranking Creator error: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
        setRows([]);
        setTotalRows(0);
      } finally {
        if (!disposed && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadRanking();

    return () => {
      disposed = true;
    };
  }, [
    supabase,
    workspaceId,
    startDate,
    endDate,
    platform,
    creatorId,
    page,
    appliedSearch,
  ]);

  useEffect(() => {
    const normalized = search.trim();

    // Empty search resets quickly; typed search is debounced to avoid
    // firing a ranking RPC for every keystroke.
    const timer = window.setTimeout(
      () => {
        setPage(1);
        setAppliedSearch(normalized);
      },
      normalized ? 450 : 150
    );

    return () => window.clearTimeout(timer);
  }, [search]);

  function applySearch() {
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function resetSearch() {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }

  function goToPage(targetPage: number) {
    if (targetPage < 1) return;
    if (targetPage > totalPages) return;

    setPage(targetPage);
  }

  const startRow =
    totalRows === 0
      ? 0
      : (page - 1) * PAGE_SIZE + 1;

  const endRow =
    totalRows === 0
      ? 0
      : Math.min(page * PAGE_SIZE, totalRows);

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
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2>Ranking Creator</h2>

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
            ? `${formatNumber(startRow)}–${formatNumber(
                endRow
              )} dari ${formatNumber(totalRows)} creator`
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
            if (e.key === "Enter") {
              applySearch();
            }
          }}
          style={{
            flex: "1 1 350px",
            minWidth: 250,
            padding: 10,
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={applySearch}
          disabled={loading}
          style={{
            padding: "10px 18px",
            cursor: loading
              ? "wait"
              : "pointer",
          }}
        >
          Search
        </button>

        <button
          onClick={resetSearch}
          disabled={loading && !appliedSearch}
          style={{
            padding: "10px 18px",
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
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
            }}
          >
            Loading ranking creator...
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              color: "#666",
            }}
          >
            Tidak ada data creator untuk filter ini.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
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
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: 12,
                      textAlign:
                        header === "Rank" ||
                        header === "Qty" ||
                        header === "Orders"
                          ? "right"
                          : "left",
                      borderBottom:
                        "1px solid #ddd",
                      background: "#f7f7f7",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.creator_id}>
                  <td
                    style={{
                      padding: 12,
                      textAlign: "right",
                      borderBottom:
                        "1px solid #eee",
                      fontWeight: 700,
                    }}
                  >
                    {formatNumber(row.rank)}
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
                        fontWeight: 600,
                      }}
                    >
                      {row.creator_name ||
                        "-"}
                    </div>

                    {row.creator_code && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#777",
                          marginTop: 3,
                        }}
                      >
                        {row.creator_code}
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
                    {row.username || "-"}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      borderBottom:
                        "1px solid #eee",
                    }}
                  >
                    {row.platform || "-"}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      textAlign: "right",
                      borderBottom:
                        "1px solid #eee",
                    }}
                  >
                    {formatNumber(row.qty)}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      textAlign: "right",
                      borderBottom:
                        "1px solid #eee",
                    }}
                  >
                    {formatNumber(row.orders)}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      textAlign: "right",
                      borderBottom:
                        "1px solid #eee",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCurrency(row.gmv)}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      textAlign: "right",
                      borderBottom:
                        "1px solid #eee",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCurrency(
                      row.commission
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINATION */}

      {totalRows > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
            Page {formatNumber(page)} dari{" "}
            {formatNumber(totalPages)}
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
                goToPage(page - 1)
              }
              disabled={page === 1 || loading}
              style={{
                padding: "8px 12px",
                cursor:
                  page === 1 || loading
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Previous
            </button>

            {Array.from(
              {
                length: Math.min(
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
                    page - 3 + index;

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
                    key={pageNumber}
                    onClick={() =>
                      goToPage(
                        pageNumber
                      )
                    }
                    disabled={loading}
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
                    {pageNumber}
                  </button>
                );
              }
            )}

            <button
              onClick={() =>
                goToPage(page + 1)
              }
              disabled={
                page >= totalPages ||
                loading
              }
              style={{
                padding: "8px 12px",
                cursor:
                  page >= totalPages ||
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

      {error && (
        <p
          style={{
            color: "red",
            marginTop: 20,
            padding: 15,
            border: "1px solid red",
            borderRadius: 6,
          }}
        >
          {error}
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
        Platform: {platform || "All"}
        {appliedSearch
          ? ` | Search: ${appliedSearch}`
          : ""}
      </div>
    </section>
  );
}