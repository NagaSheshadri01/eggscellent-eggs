const { PgDump } = require('pg-dump-restore-nodejs');

async function dump() {
  const pgDump = new PgDump({
    uri: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`,
    dumpFile: 'schema_backup.sql',
    format: 'plain',
    args: ['--schema-only']
  });

  try {
    await pgDump.execute();
    console.log("Successfully dumped schema to schema_backup.sql");
  } catch (e) {
    console.error("Error dumping schema:", e);
    
    // Try the direct connection instead of pooler
    console.log("Trying direct connection...");
    const pgDumpDirect = new PgDump({
      uri: `postgresql://postgres:${encodeURIComponent('A01b02z26y25_SPB')}@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres`,
      dumpFile: 'schema_backup.sql',
      format: 'plain',
      args: ['--schema-only']
    });
    
    try {
      await pgDumpDirect.execute();
      console.log("Successfully dumped schema using direct connection");
    } catch (e2) {
      console.error("Error with direct connection:", e2);
    }
  }
}

dump();
