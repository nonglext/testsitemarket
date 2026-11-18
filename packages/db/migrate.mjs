import pg from 'pg';
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const db = new pg.Client({connectionString:process.env.DATABASE_URL});
const dir = new URL('./prisma/migrations/', import.meta.url);
await db.connect();
try {
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(7472391)');
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text primary key, checksum text not null)');
  for (const name of (await readdir(dir)).sort()) {
    const sql = await readFile(new URL(name+'/migration.sql',dir),'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const prior = await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
    if (prior.rowCount) {
      if(prior.rows[0].checksum!==checksum) throw Error('Migration changed: '+name);
      continue;
    }
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations VALUES($1,$2)',[name,checksum]);
  }
  await db.query('COMMIT');
} catch(error) { await db.query('ROLLBACK'); throw error; }
finally { await db.end(); }
