import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use node-postgres Pool for direct Postgres connections (suits local/remote Postgres on tcp:5432).
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export async function ensureSchema(): Promise<void> {
  // Create app_settings table if missing and add webhook_behavior column and webhook tables if missing.
  // Use simple SQL commands with IF NOT EXISTS to be idempotent.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // app_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key varchar PRIMARY KEY,
        value jsonb,
        updated_at timestamptz DEFAULT now()
      );
    `);

    // webhooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        url text NOT NULL,
        verify_token text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    // webhook_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id varchar REFERENCES webhooks(id) ON DELETE SET NULL,
        headers jsonb,
        query jsonb,
        body jsonb,
        response jsonb,
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL;
    `);

    await client.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS sent_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL;
    `);

    await client.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS reply_to_message_id varchar REFERENCES messages(id) ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_reply_to
      ON messages (conversation_id, reply_to_message_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_direction
      ON messages (direction);
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
