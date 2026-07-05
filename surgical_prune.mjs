import fs from 'fs';

const filePath = 'src/components/site/CartDrawer.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Prune the state
content = content.replace(/  const \[step, setStep\] = useState<CheckoutStep>\("cart"\);\n/, '');
content = content.replace(/  const \[payment, setPayment\] = useState<"online" \| "upi" \| "cod" \| "wallet">\("cod"\);\n/, '');
content = content.replace(/  const \[selectedSlotId, setSelectedSlotId\] = useState<string\(\) \| undefined>\(\);\n/, '');
// Wait, the regex for selectedSlotId needs to be more permissive because of the `<string>`
content = content.replace(/  const \[selectedSlotId, setSelectedSlotId\] = useState<string>\(\);\n/g, '');
content = content.replace(/  const \[deliveryDate, setDeliveryDate\] = useState<Date>\(new Date\(\)\);\n/g, '');
content = content.replace(/  const \[addrServiceable, setAddrServiceable\] = useState\(true\);\n/g, '');
content = content.replace(/  const \[checkingAddr, setCheckingAddr\] = useState\(false\);\n/g, '');
content = content.replace(/  const \[isAddressFormOpen, setIsAddressFormOpen\] = useState\(false\);\n/g, '');

// Also remove CheckoutStep type if it's there
content = content.replace(/type CheckoutStep = "cart" \| "address" \| "slots" \| "payment";\n/, '');

// Also remove the step reset in useEffect
content = content.replace(/  \/\/ Reset to cart step when drawer closes\n  useEffect\(\(\) => \{ if \(!open\) setTimeout\(\(\) => setStep\("cart"\), 300\); \}, \[open\]\);\n/, '');

// Clean up stepLabel if it's there
content = content.replace(/  const stepLabel = \{ cart: "Your Cart", address: "Delivery Address", slots: "Delivery Time", payment: "Payment" \}\[step\];\n/, '');

// 2. Fix the header
const headerRegex = /          \{\/\* ── HEADER ── \*\/\}[\s\S]*?<\/SheetHeader>/g;
const newHeader = `          {/* ── HEADER ── */}
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-brown text-xl flex items-center gap-3">
              <ShoppingBag className="w-5 h-5" />
              Your Cart
              {count > 0 && <span className="text-sm text-muted-foreground font-body font-normal">({count})</span>}
            </SheetTitle>
          </SheetHeader>`;
content = content.replace(headerRegex, newHeader);


// 3. Remove Address, Slots, Payment UI.
// They start at {/* ═══ STEP: ADDRESS */} and end at {/* ── BILLING AREA ── */}
const addressRegex = /                \{\/\* ═══ STEP: ADDRESS ═══ \*\/\}[\s\S]*?\{\/\* ── BILLING AREA ── \*\/\}/;
content = content.replace(addressRegex, '                {/* ── BILLING AREA ── */}');

// Remove {step === "cart" && ( wrappers around the cart items
content = content.replace(/                \{\/\* ═══ STEP: CART ═══ \*\/\}\n                \{step === "cart" && \(\n/, '                {/* ═══ STEP: CART ═══ */}\n');
content = content.replace(/                  <\/div>\n                \)\}\n\n                \{\/\* ── BILLING AREA ── \*\/\}/, '                  </div>\n\n                {/* ── BILLING AREA ── */}');


// 4. Enforce the redirect button at the bottom.
// Wait, the user provided exact CTA HTML
const ctaReplacement = `                <div className="p-4 bg-background border-t">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Subtotal</span>
                    <span className="text-xl font-serif font-bold">₹{total}</span>
                  </div>
                  <Button className="w-full h-12 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                      setOpen(false); // Close the drawer
                      nav("/checkout"); // Redirect to the standalone checkout page
                    }}
                  >
                    Proceed to Checkout <ChevronRight className="ml-2 h-5 w-5"/>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>`;

// Replace from {/* ── BILLING AREA ── */} downwards until </SheetContent>
const billingRegex = /                \{\/\* ── BILLING AREA ── \*\/\}[\s\S]*?<\/SheetContent>/g;
content = content.replace(billingRegex, ctaReplacement);

// 5. Delete dead functions that rely on deleted state (placeOrder, goToAddress, goToSlots, goToPayment, etc.)
content = content.replace(/  const goToAddress = \(\) => \{[\s\S]*?\};\n/g, '');
content = content.replace(/  const goToSlots = \(\) => \{[\s\S]*?\};\n/g, '');
content = content.replace(/  const goToPayment = \(\) => \{[\s\S]*?\};\n/g, '');
content = content.replace(/  const placeOrder = async \(\) => \{[\s\S]*?nav\("\/account\?tab=subscriptions"\);\s*\}\s*\};\n/g, '');

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Surgical pruning of CartDrawer complete.");
