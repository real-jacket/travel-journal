#!/usr/bin/env node
// Fetch every manifest listed in trips.json, validate it, and write src/data/trips.generated.json.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateTrip } from "../src/data/trip-schema.js";

const root = new URL("../", import.meta.url);
const MAX_BYTES = 64 * 1024;

async function fetchWithRetry(url, options = {}) {
  let error;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000), ...options });
      if (response.status === 200) return response;
      error = new Error(`HTTP ${response.status}`);
    } catch (cause) { error = cause; }
  }
  throw error;
}

async function loadManifest(url) {
  const response = await fetchWithRetry(url);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error(`manifest is larger than ${MAX_BYTES} bytes`);
  return validateTrip(JSON.parse(body.toString("utf8")), url);
}

try {
  const urls = JSON.parse(await readFile(new URL("trips.json", root), "utf8"));
  if (!Array.isArray(urls) || !urls.length) throw new Error("trips.json must be a non-empty array of manifest URLs");
  if (new Set(urls).size !== urls.length) throw new Error("trips.json contains duplicate URLs");
  const trips = [];
  for (const url of urls) {
    if (typeof url !== "string" || new URL(url).protocol !== "https:") throw new Error(`${url}: must be an https URL`);
    let trip;
    try {
      trip = await loadManifest(url);
      const image = await fetchWithRetry(trip.image, { method: "GET" });
      if (!image.headers.get("content-type")?.startsWith("image/")) throw new Error(`image ${trip.image} is not an image/* response`);
      await image.body?.cancel();
    } catch (error) {
      throw new Error(error.message.startsWith(url) ? error.message : `${url}: ${error.message}`);
    }
    if (trips.some((other) => other.id === trip.id)) throw new Error(`${url}: duplicate trip id "${trip.id}"`);
    trips.push(trip);
  }
  await writeFile(fileURLToPath(new URL("src/data/trips.generated.json", root)), `${JSON.stringify(trips, null, 2)}\n`);
  console.log(`Synced ${trips.length} trips: ${trips.map((trip) => trip.id).join(", ")}`);
} catch (error) {
  console.error(`trips:sync failed: ${error.message}`);
  process.exit(1);
}
