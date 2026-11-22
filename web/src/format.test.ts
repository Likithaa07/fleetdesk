import { describe, expect, it } from 'vitest';
import { daysUntil, formatDate, formatKm, formatMoney, leaseNotice, regoNotice, serviceNotice } from './format';

describe('formatDate', () => {
  it('writes the day, short month and year', () => {
    expect(formatDate('2026-11-23')).toBe('23 Nov 2026');
  });

  it('drops the leading zero from the day', () => {
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026');
  });

  it('ignores a time part', () => {
    expect(formatDate('2026-11-23T10:30:00')).toBe('23 Nov 2026');
  });

  it('returns text that is not a date unchanged', () => {
    expect(formatDate('not a date')).toBe('not a date');
  });

  it('returns an impossible month unchanged', () => {
    expect(formatDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('formatKm', () => {
  it('adds thousands separators', () => {
    expect(formatKm(24000)).toBe('24,000 km');
    expect(formatKm(1234567)).toBe('1,234,567 km');
  });

  it('leaves small numbers alone', () => {
    expect(formatKm(0)).toBe('0 km');
    expect(formatKm(999)).toBe('999 km');
  });
});

describe('formatMoney', () => {
  it('always shows two decimals', () => {
    expect(formatMoney(400)).toBe('$400.00');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('adds thousands separators', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });
});

describe('daysUntil', () => {
  const now = new Date(2026, 10, 23, 9, 0);

  it('is 0 for today', () => {
    expect(daysUntil('2026-11-23', now)).toBe(0);
  });

  it('counts forward and back', () => {
    expect(daysUntil('2026-11-24', now)).toBe(1);
    expect(daysUntil('2026-11-22', now)).toBe(-1);
  });

  it('crosses a month boundary', () => {
    expect(daysUntil('2026-12-01', now)).toBe(8);
  });

  it('crosses a year boundary', () => {
    expect(daysUntil('2027-01-01', new Date(2026, 11, 31))).toBe(1);
  });

  it('ignores the time of day', () => {
    expect(daysUntil('2026-11-23', new Date(2026, 10, 23, 23, 59))).toBe(0);
  });
});

describe('regoNotice', () => {
  it('says expired once the date has passed', () => {
    expect(regoNotice(-1)).toEqual({ label: 'Expired', tone: 'bad' });
  });

  it('warns on the day it expires', () => {
    expect(regoNotice(0)).toEqual({ label: 'Expires today', tone: 'warn' });
  });

  it('uses the singular for one day and counts up to 30', () => {
    expect(regoNotice(1)).toEqual({ label: 'Expires in 1 day', tone: 'warn' });
    expect(regoNotice(30)).toEqual({ label: 'Expires in 30 days', tone: 'warn' });
  });

  it('has no notice beyond 30 days', () => {
    expect(regoNotice(31)).toBeNull();
    expect(regoNotice(400)).toBeNull();
  });
});

describe('serviceNotice', () => {
  it('says overdue once the date has passed', () => {
    expect(serviceNotice(-1)).toEqual({ label: 'Overdue', tone: 'bad' });
  });

  it('has no notice when the service is due today or later', () => {
    expect(serviceNotice(0)).toBeNull();
    expect(serviceNotice(5)).toBeNull();
  });
});

describe('leaseNotice', () => {
  it('has no notice once the lease has ended', () => {
    expect(leaseNotice(-1)).toBeNull();
  });

  it('warns on the day it ends', () => {
    expect(leaseNotice(0)).toEqual({ label: 'Ends today', tone: 'warn' });
  });

  it('uses the singular for one day and counts up to 60', () => {
    expect(leaseNotice(1)).toEqual({ label: 'Ends in 1 day', tone: 'warn' });
    expect(leaseNotice(60)).toEqual({ label: 'Ends in 60 days', tone: 'warn' });
  });

  it('has no notice beyond 60 days', () => {
    expect(leaseNotice(61)).toBeNull();
  });
});
