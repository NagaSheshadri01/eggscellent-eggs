import fs from 'fs';

let content = fs.readFileSync('src/pages/Partner.tsx', 'utf-8');

const regex = /const todayStr = new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];[\s\S]*?const \[subscriptionTab, setSubscriptionTab\] = useState<'today' \| 'tomorrow'>\('today'\);/;

const replacement = `const getPartnerLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return \`\${year}-\${month}-\${day}\`;
  };

  const [todayStr, setTodayStr] = useState(() => getPartnerLocalDateString());
  const [tomorrowStr, setTomorrowStr] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return getPartnerLocalDateString(t);
  });

  useEffect(() => {
    const syncPartnerDateView = () => {
      if (document.visibilityState === 'visible') {
        setTodayStr(getPartnerLocalDateString());
        const t = new Date();
        t.setDate(t.getDate() + 1);
        setTomorrowStr(getPartnerLocalDateString(t));
        qc.invalidateQueries({ queryKey: ["driver-active-shift"] });
      }
    };
    document.addEventListener('visibilitychange', syncPartnerDateView);
    return () => document.removeEventListener('visibilitychange', syncPartnerDateView);
  }, [qc]);

  const [subscriptionTab, setSubscriptionTab] = useState<'today' | 'tomorrow'>('today');`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('src/pages/Partner.tsx', content);
  console.log('Success');
} else {
  console.log('Target regex not found in Partner.tsx');
}
