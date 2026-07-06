function isDateLocked(targetDate) {
  const now = new Date();
  const currentUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  // 9 PM IST is 21:00. UTC = 21:00 - 5:30 = 15.5
  const passed9PM = currentUTC >= 15.5;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays <= 0) return true; // Past or today
  if (diffDays === 1) return passed9PM; // Tomorrow
  return false; // Future
}

console.log("Today:", isDateLocked(new Date()));
console.log("Tomorrow:", isDateLocked(new Date(Date.now() + 86400000)));
console.log("Day After:", isDateLocked(new Date(Date.now() + 86400000 * 2)));
