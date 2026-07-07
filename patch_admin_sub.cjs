const fs = require('fs');

const path = 'src/pages/admin/AdminSubscriptions.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update subscriptionsQ to include addresses
content = content.replace(
  /profiles:user_id \(full_name, email, phone\),\s*\n\s*\)/g,
  "profiles:user_id (full_name, email, phone),\n          addresses:address_id (*)\n        )"
);

// 2. Remove Tab 2: Today's Dispatch Queue code block
const dispatchQStart = content.indexOf('// Tab 2: Today\'s Dispatch Queue');
const dispatchQEnd = content.indexOf('// Tab 3: Subscription Plans Catalog');
if (dispatchQStart !== -1 && dispatchQEnd !== -1) {
  content = content.slice(0, dispatchQStart) + content.slice(dispatchQEnd);
}

// 3. Remove assignPartner mutation
const assignPartnerStart = content.indexOf('const assignPartner = useMutation({');
const assignPartnerEnd = content.indexOf('const createPlan = useMutation({');
if (assignPartnerStart !== -1 && assignPartnerEnd !== -1) {
  content = content.slice(0, assignPartnerStart) + content.slice(assignPartnerEnd);
}

// 4. Remove Priority Sorting Logic for Dispatch
const sortedDispatchStart = content.indexOf('// Priority Sorting Logic for Dispatch');
const sortedDispatchEnd = content.indexOf('return (', sortedDispatchStart);
if (sortedDispatchStart !== -1 && sortedDispatchEnd !== -1) {
  content = content.slice(0, sortedDispatchStart) + content.slice(sortedDispatchEnd);
}

// 5. Remove UI components for dispatch
content = content.replace(/<TabsTrigger value="dispatch".*?<\/TabsTrigger>/gs, "");
content = content.replace(/{\/\* ── TAB: LIVE DISPATCH ── \*\/}.*?<\/TabsContent>/gs, "");
// Let's use a regex to carefully remove the live dispatch tab content
// The tab content for dispatch usually starts with `<TabsContent value="dispatch">` and ends with `</TabsContent>`. 
// Because of the nested structure, regex might be tricky, I'll use a safer approach or just search and replace if I can see it.
fs.writeFileSync(path, content, 'utf8');
