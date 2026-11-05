/** Hosted secrets may still contain the prior runtime username after the database rename. */
export function runtimeConnectionString(value: string) {
  if (!value) return value;
  try {
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const legacy = 'mywallet_runtime';
    if (username !== legacy && !username.startsWith(`${legacy}.`)) return value;
    url.username = `plannedwallet_runtime${username.slice(legacy.length)}`;
    return url.href;
  } catch {
    return value;
  }
}
