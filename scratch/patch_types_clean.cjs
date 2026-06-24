const fs = require('fs');

const typesPath = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(typesPath, 'utf8');

const tablesStartIdx = content.indexOf('Tables: {') + 'Tables: {'.length;

let bracesCount = 1;
let tablesEndIdx = -1;

for (let i = tablesStartIdx; i < content.length; i++) {
  if (content[i] === '{') bracesCount++;
  else if (content[i] === '}') {
    bracesCount--;
    if (bracesCount === 0) {
      tablesEndIdx = i;
      break;
    }
  }
}

let tablesStr = content.substring(tablesStartIdx, tablesEndIdx);

// Now tablesStr contains the inner part of Tables: { ... }
// We can find all tables by looking for `      tablename: {`
const tablePattern = /^\s+([a-zA-Z_0-9]+):\s*\{/gm;
let match;
const tables = [];
while ((match = tablePattern.exec(tablesStr)) !== null) {
  tables.push({ name: match[1], startIndex: match.index });
}

// For each table, find its end by counting braces
for (let i = tables.length - 1; i >= 0; i--) {
  const table = tables[i];
  let tBracesCount = 0;
  let tStart = table.startIndex;
  // find the first {
  while (tablesStr[tStart] !== '{') tStart++;
  
  let tEnd = -1;
  for (let j = tStart; j < tablesStr.length; j++) {
    if (tablesStr[j] === '{') tBracesCount++;
    else if (tablesStr[j] === '}') {
      tBracesCount--;
      if (tBracesCount === 0) {
        tEnd = j;
        break;
      }
    }
  }
  
  // Now we have the table string
  const tableStr = tablesStr.substring(table.startIndex, tEnd + 1);
  if (!tableStr.includes('Relationships:')) {
    // Insert Relationships: [] before the last }
    const patchedTableStr = tableStr.substring(0, tableStr.length - 1) + '  Relationships: []\n      }';
    tablesStr = tablesStr.substring(0, table.startIndex) + patchedTableStr + tablesStr.substring(tEnd + 1);
  }
}

content = content.substring(0, tablesStartIdx) + tablesStr + content.substring(tablesEndIdx);
fs.writeFileSync(typesPath, content, 'utf8');
console.log('Added missing Relationships to backup types.ts');
