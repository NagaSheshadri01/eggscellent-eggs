const fs = require('fs');
const json = JSON.parse(fs.readFileSync('scratch/openapi.json', 'utf8'));
const tables = json.definitions;
const oto = tables['one_time_orders'];
if (oto) {
  console.log("Columns:", Object.keys(oto.properties));
} else {
  console.log("Table not found in definitions. Keys are:", Object.keys(json.definitions));
}
