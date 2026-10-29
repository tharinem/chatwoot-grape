// Conversions between the API's scheduled_at and the datetime-local input.
// Kept free of imports so specs can load it in a process with another TZ.

// Smallest lead time accepted for a scheduled campaign. A campaign scheduled
// in the past is picked up by the scheduler right away and can't run again.
export const MIN_SCHEDULE_LEAD_MINUTES = 2;

const toLocalInputString = date => {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
};

// scheduled_at comes from the API as a unix timestamp (seconds); the
// datetime-local input expects local time as YYYY-MM-DDTHH:mm.
export const toLocalDateTimeInput = timestamp => {
  if (!timestamp) return null;
  return toLocalInputString(new Date(timestamp * 1000));
};

// The input value has no offset, so the Date constructor reads it as local
// time; toISOString turns it into the UTC instant sent to the API.
export const formatToUTCString = localDateTime =>
  localDateTime ? new Date(localDateTime).toISOString() : null;

export const currentLocalDateTimeInput = (now = Date.now()) =>
  toLocalInputString(new Date(now));

export const isAtLeastMinutesAhead = (
  localDateTime,
  minutes = MIN_SCHEDULE_LEAD_MINUTES,
  now = Date.now()
) => {
  if (!localDateTime) return false;
  const scheduled = new Date(localDateTime).getTime();
  if (Number.isNaN(scheduled)) return false;
  return scheduled >= now + minutes * 60000;
};
