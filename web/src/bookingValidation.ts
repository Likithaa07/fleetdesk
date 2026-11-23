export interface BookingInput {
  startDate: string;
  endDate: string;
  purpose: string;
}

export interface BookingErrors {
  startDate?: string;
  endDate?: string;
  purpose?: string;
}

// Today's date as YYYY-MM-DD in the user's own time zone.
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Quick checks before calling the API. The API still enforces every rule (BR1 to BR3).
export function validateBooking(input: BookingInput, today: string = todayIso()): BookingErrors {
  const errors: BookingErrors = {};

  if (!input.startDate) errors.startDate = 'Choose a start date.';
  else if (input.startDate < today) errors.startDate = 'The start date cannot be in the past.';

  if (!input.endDate) errors.endDate = 'Choose an end date.';
  else if (input.startDate && input.endDate < input.startDate) {
    errors.endDate = 'The end date cannot be before the start date.';
  }

  if (!input.purpose.trim()) errors.purpose = 'Enter the purpose of the trip.';

  return errors;
}
