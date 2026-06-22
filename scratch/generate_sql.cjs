const fs = require('fs');

const dump = JSON.parse(fs.readFileSync('scratch/schema_dump.json', 'utf8'));

let sql = `-- Supabase Schema Dump\n-- Generated from JSON Backup\n\n`;

// Group columns by table
const tables = {};
for (const col of dump.columns) {
  if (!tables[col.table_name]) tables[col.table_name] = [];
  tables[col.table_name].push(col);
}

// Generate CREATE TABLE statements
for (const [tableName, columns] of Object.entries(tables)) {
  sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
  const colDefs = columns.map(c => {
    let def = `  ${c.column_name} ${c.data_type}`;
    if (c.is_nullable === 'NO') def += ' NOT NULL';
    if (c.column_default) def += ` DEFAULT ${c.column_default}`;
    return def;
  });
  sql += colDefs.join(',\n');
  sql += `\n);\n\n`;
}

// Generate constraints
sql += `-- CONSTRAINTS --\n\n`;
for (const con of dump.constraints) {
  sql += `ALTER TABLE public.${con.table_name} ADD CONSTRAINT ${con.constraint_name} ${con.definition};\n`;
}

sql += `\n-- INDEXES --\n\n`;
for (const idx of dump.indexes) {
  sql += `${idx.indexdef};\n`;
}

fs.writeFileSync('schema_backup.sql', sql);
console.log('Successfully generated schema_backup.sql!');
