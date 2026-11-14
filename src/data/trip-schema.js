const MAX_TEXT = 300;
const text = ["title", "subtitle", "region", "statusLabel", "date", "dateNote", "duration", "transport", "description", "imageAlt", "imageCredit", "highlights"];
const lists = { route: [2, 30], tags: [1, 12] };

// Validate one trip.json and return the normalized trip (absolute `url` and `image`), or throw naming the field and manifest.
export function validateTrip(manifest, manifestUrl) {
  const fail = (field, why) => { throw new Error(`${manifestUrl}: ${field} ${why}`); };
  const str = (field, value = manifest?.[field]) => {
    if (typeof value !== "string" || !value.trim()) fail(field, "must be a non-empty string");
    if (value.length > MAX_TEXT) fail(field, `must be at most ${MAX_TEXT} characters`);
    return value;
  };
  const httpsUrl = (field, value, base) => {
    let url;
    try { url = new URL(value, base); } catch { fail(field, "must be a valid URL"); }
    if (url.protocol !== "https:") fail(field, "must resolve to an https: URL");
    return url.href;
  };
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("manifest", "must be a JSON object");

  const trip = Object.fromEntries(text.map((field) => [field, str(field)]));
  if (typeof manifest.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) fail("id", "must be lowercase letters, digits and single hyphens");
  trip.id = manifest.id;
  if (!["planned", "archived"].includes(manifest.status)) fail("status", 'must be "planned" or "archived"');
  trip.status = manifest.status;
  if (!/^\d{4}/.test(trip.date)) fail("date", "must start with a 4-digit year");
  for (const [field, [min, max]] of Object.entries(lists)) {
    const list = manifest[field];
    if (!Array.isArray(list) || list.length < min || list.length > max) fail(field, `must be an array of ${min}-${max} strings`);
    trip[field] = list.map((item) => str(field, item));
  }

  trip.image = httpsUrl("image", str("image"), manifestUrl);
  const source = manifest.imageSource;
  if (typeof source !== "string") fail("imageSource", 'must be an https URL or ""');
  trip.imageSource = source && httpsUrl("imageSource", str("imageSource"));
  trip.url = httpsUrl("url", manifest.url === undefined ? "./" : str("url"), manifestUrl);
  return trip;
}
