import fs from 'fs';

const filePath = 'src/components/site/CartDrawer.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Remove CheckoutStep type
content = content.replace(/type CheckoutStep = "cart" \| "address" \| "slots" \| "payment";\n/, '');

// 2. Remove state and reset
content = content.replace(/  const \[step, setStep\] = useState<CheckoutStep>\("cart"\);\n/, '');
content = content.replace(/  \/\/ Reset to cart step when drawer closes\n  useEffect\(\(\) => \{ if \(!open\) setTimeout\(\(\) => setStep\("cart"\), 300\); \}, \[open\]\);\n/, '');

// 3. Remove stepLabel helper
content = content.replace(/  \/\/ Step label helpers\n  const stepLabel = \{ cart: "Your Cart", address: "Delivery Address", slots: "Delivery Time", payment: "Payment" \}\[step\];\n/, '');

// 4. Fix Header (back button and title)
content = content.replace(/              \{step !== "cart" && \([\s\S]*?<\/button>\n              \)\}\n              <ShoppingBag className="w-5 h-5" \/>\n              \{stepLabel\}\n              \{step === "cart" && count > 0/g, '              <ShoppingBag className="w-5 h-5" />\n              Your Cart\n              {count > 0');

// 5. Remove Progress Bar
content = content.replace(/            \{\/\* Step progress bar \*\/\}[\s\S]*?            \)\}\n/g, '');

// 6. Fix Cart Step opening
content = content.replace(/                \{\/\* ═══ STEP: CART ═══ \*\/යට                \{step === "cart" && \(\n/g, '                {/* ═══ STEP: CART ═══ */}\n');
content = content.replace(/                \{\/\* ═══ STEP: CART ═══ \*\/\}\n                \{step === "cart" && \(\n/g, '                {/* ═══ STEP: CART ═══ */}\n');

// 7. Fix Cart Step closing & Remove Address, Slots, Payment steps
// Find the exact closing of step === "cart"
const split1 = content.split('                {/* ═══ STEP: ADDRESS ═══ */}');
if (split1.length > 1) {
    let before = split1[0];
    // Remove the `)}` that closed the cart step
    before = before.replace(/                  <\/div>\n                \)\}\n\n$/g, '                  </div>\n\n');
    
    let after = '                {/* ═══ STEP: ADDRESS ═══ */}' + split1[1];
    
    const split2 = after.split('              <div className="p-4 border-t border-border bg-card shrink-0">');
    if (split2.length > 1) {
        content = before + '              <div className="p-4 border-t border-border bg-card shrink-0">' + split2[1];
    }
}

// 8. Fix Billing Labels
content = content.replace(/\{hasSubscriptionInCart \? "Per Delivery" : \(step === "cart" \? "Subtotal" : "Grand Total"\)\}/g, '{hasSubscriptionInCart ? "Per Delivery" : "Subtotal"}');
content = content.replace(/\{hasSubscriptionInCart \? `₹\$\{perDeliveryCost\}` : `₹\$\{step === "cart" \? total : finalTotal\}`\}/g, '{hasSubscriptionInCart ? `₹${perDeliveryCost}` : `₹${total}`}');

// 9. Replace CTA block
const ctaRegex = /                \{\/\* CTA — changes per step \*\/\}[\s\S]*?              <\/div>\n            <\/([^>]+)>\n          \)\}\n        <\/SheetContent>/g;
const ctaReplacement = `                {/* CTA */}
                <div className="w-full space-y-3">
                  {isBelowMinOrder && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg font-medium text-sm border border-red-100">
                      Minimum order value for delivery is ₹{minOrderValue}. Please add ₹{minOrderValue - total} more to proceed!
                    </div>
                  )}
                  <Button variant="hero" size="lg" className="w-full h-12 font-bold shadow-yolk" onClick={() => {
                    setOpen(false);
                    nav("/checkout");
                  }} disabled={isBelowMinOrder}>
                    Proceed to Checkout <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </div>
              </div>
            </$1>
          )}
        </SheetContent>`;
content = content.replace(ctaRegex, ctaReplacement);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Refactored CartDrawer.tsx successfully");
