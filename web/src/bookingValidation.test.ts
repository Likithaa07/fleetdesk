import { describe, expect, it } from 'vitest';
import { todayIso, validateBooking } from './bookingValidation';

const TODAY = '2026-11-23';
const good = { startDate: '2026-12-01', endDate: '2026-12-03', purpose: 'Client meeting' };

describe('todayIso', () => {
  it('writes the local date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 10, 23, 9, 0))).toBe('2026-11-23');
  });

  it('pads single-digit months and days', () => {
    expect(todayIso(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});

describe('validateBooking', () => {
  it('accepts a valid booking', () => {
    expect(validateBooking(good, TODAY)).toEqual({});
  });

  it('accepts a booking that starts today', () => {
    expect(validateBooking({ ...good, startDate: TODAY, endDate: TODAY }, TODAY)).toEqual({});
  });

  it('accepts a one-day booking', () => {
    expect(validateBooking({ ...good, endDate: good.startDate }, TODAY)).toEqual({});
  });

  it('asks for a start date', () => {
    expect(validateBooking({ ...good, startDate: '' }, TODAY).startDate).toBe('Choose a start date.');
  });

  it('rejects a start date in the past', () => {
    expect(validateBooking({ ...good, startDate: '2026-11-22' }, TODAY).startDate).toBe(
      'The start date cannot be in the past.'
    );
  });

  it('asks for an end date', () => {
    expect(validateBooking({ ...good, endDate: '' }, TODAY).endDate).toBe('Choose an end date.');
  });

  it('rejects an end date before the start date', () => {
    expect(validateBooking({ ...good, endDate: '2026-11-30' }, TODAY).endDate).toBe(
      'The end date cannot be before the start date.'
    );
  });

  it('asks for a purpose and treats spaces as empty', () => {
    expect(validateBooking({ ...good, purpose: '   ' }, TODAY).purpose).toBe('Enter the purpose of the trip.');
  });

  it('reports every problem at once', () => {
    const errors = validateBooking({ startDate: '', endDate: '', purpose: '' }, TODAY);

    expect(Object.keys(errors).sort()).toEqual(['endDate', 'purpose', 'startDate']);
  });
});
