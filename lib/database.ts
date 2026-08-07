import { neon } from "@neondatabase/serverless";

export type CellOverride = {
  record_id: string;
  field_key: string;
  value: string;
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
