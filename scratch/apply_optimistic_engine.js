import * as fs from 'fs';

let content = fs.readFileSync('src/components/account/SubscriptionCalendar.tsx', 'utf-8');

// 1. Replace State Variables
const stateRegex = /const \[selectedDate, setSelectedDate\] = useState<Date>\(new Date\(\)\);\s*const \[dailyDeliveries, setDailyDeliveries\] = useState<any\[\]>\(\[\]\);\s*const \[globalProducts, setGlobalProducts\] = useState<any\[\]>\(\[\]\);\s*const \[horizonDates, setHorizonDates\] = useState<Date\[\]>\(\[\]\);\s*const \[loading, setLoading\] = useState<boolean>\(false\);/;

content = content.replace(stateRegex, `const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [cachedLedger, setCachedLedger] = useState<any[]>([]);
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [horizonDates, setHorizonDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Instantly compute the view target inside the UI thread (Zero Loading Spinners)
  const targetDateStr = \`\${selectedDate.getFullYear()}-\${String(selectedDate.getMonth() + 1).padStart(2, '0')}-\${String(selectedDate.getDate()).padStart(2, '0')}\`;
  const dailyDeliveries = cachedLedger.filter(item => item.delivery_date === targetDateStr);`);

// 2. Replace the fetchActiveLedgerForDate and the [selectedDate] useEffect
const oldFetchRegex = /const fetchActiveLedgerForDate = async \(\) => \{[\s\S]*?\}, \[selectedDate\]\);/m;

content = content.replace(oldFetchRegex, `const fetchBulkLedger = async () => {
    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);
      
      const startStr = \`\${today.getFullYear()}-\${String(today.getMonth() + 1).padStart(2, '0')}-\${String(today.getDate()).padStart(2, '0')}\`;
      const endStr = \`\${endDate.getFullYear()}-\${String(endDate.getMonth() + 1).padStart(2, '0')}-\${String(endDate.getDate()).padStart(2, '0')}\`;

      const { data, error } = await supabase
        .from('delivery_ledger')
        .select('id, quantity, delivery_date, product_slug, status, products(*)')
        .gte('delivery_date', startStr)
        .lte('delivery_date', endStr);

      if (error) throw error;
      const validItems = (data || []).filter(item => item.quantity > 0);
      setCachedLedger(validItems);
    } catch (err) {
      console.error(err);
    }
  };

  // IMPLEMENT 30-DAY BULK SEEDING ON MOUNT
  useEffect(() => {
    setLoading(true);
    fetchBulkLedger().finally(() => setLoading(false));
  }, []);`);

// 3. Replace all remaining fetchActiveLedgerForDate() calls
content = content.replace(/fetchActiveLedgerForDate\(\)/g, `fetchBulkLedger()`);

// 4. Update handleQuantityChange
content = content.replace(/setDailyDeliveries\(prevItems =>\s*prevItems\.map\(item => {[\s\S]*?return item;\s*}\)\s*\);/m, `const previousState = [...cachedLedger];

    setCachedLedger(prevItems => 
      prevItems.map(item => {
        // 🌟 THE CRITICAL ISOLATION GATEWAY:
        if (item.product_slug === targetSlug && item.delivery_date === targetDateStr) {
          return { 
            ...item, 
            quantity: newOptimisticQuantity,
            status: item.id.toString().startsWith('sub-fallback-') ? 'pending' : item.status 
          };
        }
        return item;
      })
    );`);

// 5. Update fetchBulkLedger() inside handleQuantityChange catch block to Revert State
const catchRegex = /catch \(err: any\) \{\s*toast\.error\(`Update failed: \$\{err\.message\}`\);\s*fetchBulkLedger\(\); \/\/ Revert on failure\s*\}/m;
content = content.replace(catchRegex, `catch (err: any) {
      toast.error(\`Update failed: \$\{err.message\}\`);
      setCachedLedger(previousState);
    }`);

// 6. Update handleDeleteCalendarItem
content = content.replace(/setDailyDeliveries\(prev => prev\.filter\(i => !\(i\.product_slug === item\.product_slug && i\.delivery_date === targetDateStr\)\)\);/, `const previousState = [...cachedLedger];
    setCachedLedger(prev => prev.filter(i => !(i.product_slug === item.product_slug && i.delivery_date === targetDateStr)));`);

content = content.replace(/catch \(err\) \{\s*toast\.error\("Failed to update item state\."\);\s*fetchBulkLedger\(\); \/\/ Revert on failure\s*\}/m, `catch (err) {
      toast.error("Failed to update item state.");
      setCachedLedger(previousState);
    }`);

fs.writeFileSync('src/components/account/SubscriptionCalendar.tsx', content);
console.log("Rewrite completed successfully!");
