//import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const plain = process.env.ADMIN_PASSWORD ?? 'Ancir2025';

  // سنخزن الـ hash في عمود password
  const hashed = await bcrypt.hash(plain, 10);

  // upsert على username (لدعم unique(username) في سكيمتك)
  await db
    .insert(users)
    .values({
      username,
      password: hashed,
      role: 'admin',         // سكيمتك default "user"؛ هنا نعيّن "admin"
      // createdAt يملأه defaultNow()
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        password: hashed,
        role: 'admin',
      },
    });

  const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  console.log('✅ Admin ready:', { id: row?.id, username: row?.username, role: row?.role });

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
