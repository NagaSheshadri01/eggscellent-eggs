const fs = require('fs');

const path = 'src/pages/admin/AdminSubscriptions.tsx';
let content = fs.readFileSync(path, 'utf8');

// Change default tab
content = content.replace('useState("dispatch")', 'useState("contracts")');

// Fix subscriptionsQ
content = content.replace(
  /subscription_items\(id, product_slug, quantity, selected_days\)/,
  ''
);

// We need to fix the rendering of subscriptionsQ.
// The rendering uses s.subscription_items?.map((item: any) => ...)
// Since the table is flattened, s itself is the item.
const renderingRegex1 = /\{s\.subscription_items\?\.map\(\(item: any\) => \([\s\S]*?<Package className="w-3\.5 h-3\.5 text-primary" \/>\s*\{item\.quantity\}x \{products\.find\(\(p: any\) => p\.slug === item\.product_slug\)\?\.name \|\| item\.product_slug\}\s*<\/div>\s*\)\)\}/;
content = content.replace(renderingRegex1, `
                          <div className="flex items-center gap-1.5 font-medium text-brown">
                            <Package className="w-3.5 h-3.5 text-primary" />
                            {s.quantity}x {products.find((p: any) => p.slug === s.product_slug)?.name || s.product_slug}
                          </div>
`);

const renderingRegex2 = /\{s\.subscription_items\?\.map\(\(item: any\) => \{\s*const days = typeof item\.selected_days === "string" \? JSON\.parse\(item\.selected_days\) : \(item\.selected_days \|\| \[\]\);\s*return \([\s\S]*?<\/div>\s*\)\}\)\}/;
content = content.replace(renderingRegex2, `
                          {(() => {
                            const days = typeof s.selected_days === "string" ? JSON.parse(s.selected_days) : (s.selected_days || []);
                            return (
                              <div className="flex gap-1">
                                {DAYS.map((day, idx) => (
                                  <span 
                                    key={day} 
                                    className={\`text-[9px] font-bold w-6 h-6 rounded-full flex items-center justify-center border \${
                                      days.includes(idx) || days.includes(String(idx))
                                        ? "bg-primary/20 border-primary text-brown" 
                                        : "bg-secondary/40 border-border text-muted-foreground"
                                    }\`}
                                  >
                                    {day[0]}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
`);

// Remove TabsTrigger for dispatch
content = content.replace(
  /<TabsTrigger value="dispatch" className="flex items-center gap-2">[\s\S]*?<\/TabsTrigger>/,
  ''
);

// Remove TabsContent for dispatch
content = content.replace(
  /\{\/\* ── TAB: TODAY'S DISPATCH ── \*\/\}\s*<TabsContent value="dispatch" className="space-y-4">[\s\S]*?\{\/\* ── TAB: ACTIVE CONTRACTS ── \*\/\}/,
  '{/* ── TAB: ACTIVE CONTRACTS ── */}'
);

fs.writeFileSync(path, content);
console.log("AdminSubscriptions patched");
