export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);
  return parts.join(" ");
};

// Two decimal places, always rounded down (floored) rather than to nearest — matches
// the Slack publish message's formatting (server/slackMessage.ts's own formatPercent,
// which this mirrors; the two can't share code across the server/src TS project
// boundary) so percentages read consistently everywhere in the app. Flooring means
// this can never overstate the real rate (e.g. 99.727% shows as "99.72%", never a
// rounded-up "99.73%" or a misleading "100%").
export const formatPercent = (value: number, total: number): string => {
  if (total === 0) return '0.00';
  const rawPercent = (value / total) * 100;
  // The tiny epsilon absorbs floating-point representation error (e.g. 58 * 100 can
  // evaluate to 5799.999999999999) so an exact percentage like 58.00 doesn't floor
  // down to 57.99 — it's far too small to ever mask a genuinely-lower value.
  const flooredToTwoDecimals = Math.floor(rawPercent * 100 + 1e-9) / 100;
  return flooredToTwoDecimals.toFixed(2);
};