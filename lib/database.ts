import { neon } from "@neondatabase/serverless";

export type CellOverride = {
  record_id: string;
  field_key: string;
  value: string;
};

export type SiteStats = {
  totalViews: number;
  todayVisitors: number;
  totalSearches: number;
};

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  return connectionString ? neon(connectionString) : null;
}

export async function listOverrides(prefix: string) {
  const sql = getSql();
  if (!sql) return [];
  await ensureSchema(sql);
  const rows = await sql.query(
    "SELECT record_id, field_key, value FROM cell_overrides WHERE record_id LIKE $1 ORDER BY record_id",
    [`${prefix}%`],
  );
  return rows as CellOverride[];
}

export async function saveOverrides(
  changes: Array<{ recordId: string; fieldKey: string; value: string }>,
) {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured");
  await ensureSchema(sql);
  for (let start = 0; start < changes.length; start += 100) {
    const batch = changes.slice(start, start + 100);
    await sql.transaction(
      batch.map((change) => sql`
        INSERT INTO cell_overrides (id, record_id, field_key, value)
        VALUES (
          ${`${change.recordId}:${change.fieldKey}`},
          ${change.recordId},
          ${change.fieldKey},
          ${change.value}
        )
        ON CONFLICT (record_id, field_key)
        DO UPDATE SET value = EXCLUDED.value
      `),
    );
  }
}

export async function getSiteStats(): Promise<SiteStats> {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured");
  await ensureStatsSchema(sql);
  const rows = await sql`
    UPDATE site_stats
    SET
      visitor_date = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD'),
      today_visitors = CASE
        WHEN visitor_date = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')
          THEN today_visitors
        ELSE 0
      END
    WHERE id = 1
    RETURNING total_views, today_visitors, total_searches
  `;
  return normalizeSiteStats(rows[0]);
}

export async function recordSiteStat(
  event: "view" | "search",
  newDailyVisitor = false,
): Promise<SiteStats> {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured");
  await ensureStatsSchema(sql);
  const visitorIncrement = newDailyVisitor ? 1 : 0;
  const rows = event === "view"
    ? await sql`
        UPDATE site_stats
        SET
          total_views = total_views + 1,
          visitor_date = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD'),
          today_visitors = CASE
            WHEN visitor_date = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')
              THEN today_visitors + ${visitorIncrement}
            ELSE ${visitorIncrement}
          END
        WHERE id = 1
        RETURNING total_views, today_visitors, total_searches
      `
    : await sql`
        UPDATE site_stats
        SET
          total_searches = total_searches + 1,
          visitor_date = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD'),
          today_visitors = CASE
            WHEN visitor_date = to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')
              THEN today_visitors
            ELSE 0
          END
        WHERE id = 1
        RETURNING total_views, today_visitors, total_searches
      `;
  return normalizeSiteStats(rows[0]);
}

function normalizeSiteStats(row: Record<string, unknown>): SiteStats {
  return {
    totalViews: Number(row.total_views),
    todayVisitors: Number(row.today_visitors),
    totalSearches: Number(row.total_searches),
  };
}

async function ensureStatsSchema(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS site_stats (
      id SMALLINT PRIMARY KEY,
      total_views BIGINT NOT NULL DEFAULT 0,
      today_visitors BIGINT NOT NULL DEFAULT 0,
      total_searches BIGINT NOT NULL DEFAULT 0,
      visitor_date TEXT NOT NULL
    )
  `;
  await sql`
    INSERT INTO site_stats (id, total_views, today_visitors, total_searches, visitor_date)
    VALUES (1, 0, 0, 0, to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD'))
    ON CONFLICT (id) DO NOTHING
  `;
}

async function ensureSchema(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS cell_overrides (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      value TEXT NOT NULL
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cell_overrides_record_field
    ON cell_overrides(record_id, field_key)
  `;
}
