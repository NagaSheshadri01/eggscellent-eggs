const fs = require('fs');
let content = fs.readFileSync('src/pages/Partner.tsx', 'utf8');

content = content.replace(/\.from\('orders'\)/g, '.from(\'one_time_orders\')');
content = content.replace(/\.from\("orders"\)/g, '.from("one_time_orders")');
content = content.replace(/order_status/g, 'status');

fs.writeFileSync('src/pages/Partner.tsx', content, 'utf8');
console.log('Patched Partner.tsx');
