/**
 * Tiny relative-time formatter. No date-fns / dayjs dependency.
 *
 *   timeAgo(new Date(Date.now() - 90_000)) -> "a minute ago"
 *   timeAgo("2025-12-30T12:00:00Z")        -> "5 months ago"
 *   timeAgo(null)                          -> "just now"
 */
export function timeAgo(value) {
  if (!value) return 'just now';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'just now';

  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec} seconds ago`;

  const min = Math.round(sec / 60);
  if (min === 1) return 'a minute ago';
  if (min < 60) return `${min} minutes ago`;

  const hr = Math.round(min / 60);
  if (hr === 1) return 'an hour ago';
  if (hr < 24) return `${hr} hours ago`;

  const day = Math.round(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 30) return `${day} days ago`;

  const mon = Math.round(day / 30);
  if (mon === 1) return 'a month ago';
  if (mon < 12) return `${mon} months ago`;

  const yr = Math.round(mon / 12);
  return yr === 1 ? 'a year ago' : `${yr} years ago`;
}

export default timeAgo;
