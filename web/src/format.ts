const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

const withCommas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatKm(km: number): string {
  return `${withCommas(String(Math.round(km)))} km`;
}

export function formatMoney(amount: number): string {
  return `$${withCommas(amount.toFixed(2))}`;
}

export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export interface Notice {
  label: string;
  tone: 'warn' | 'bad';
}

const dayCount = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

export function regoNotice(daysLeft: number): Notice | null {
  if (daysLeft < 0) return { label: 'Expired', tone: 'bad' };
  if (daysLeft === 0) return { label: 'Expires today', tone: 'warn' };
  if (daysLeft <= 30) return { label: `Expires in ${dayCount(daysLeft)}`, tone: 'warn' };
  return null;
}

export function serviceNotice(daysLeft: number): Notice | null {
  return daysLeft < 0 ? { label: 'Overdue', tone: 'bad' } : null;
}

export function leaseNotice(daysLeft: number): Notice | null {
  if (daysLeft < 0 || daysLeft > 60) return null;
  if (daysLeft === 0) return { label: 'Ends today', tone: 'warn' };
  return { label: `Ends in ${dayCount(daysLeft)}`, tone: 'warn' };
}
