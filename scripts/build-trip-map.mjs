#!/usr/bin/env node
// Authoring-time map builder (run once per trip, commit the outputs).
// usage: node scripts/build-trip-map.mjs <slug|path/to/map.json> [--extract] [--dry-run] [--landcover] [--routes] [--validate]
//   no flag      print the two `pmtiles extract` commands
//   --extract    run them (add --dry-run to only report sizes); PMTILES=/path/to/pmtiles if not on PATH
//   --landcover  build map/landcover.pmtiles from ESA WorldCover 2021 (CC-BY 4.0) with scripts/build-landcover.py (needs uv; downloads ~136 MB per 3 deg source tile into work/cache/worldcover)
//   --validate   only run the backtrack check on the existing public/trips/<slug>/map/routes.geojson (for routes reused from an earlier roadbook)
//   --routes     fetch OSRM demo routes (<=1 req/s, non-commercial; behind a proxy run with NODE_USE_ENV_PROXY=1) -> public/trips/<slug>/map/routes.geojson
//                prints WARNING when a waypoint is >300 m from its snapped road or the route retraces itself >200 m (dead-end spur): move that waypoint onto the through road.
// map.json: { base:{url,maxzoom|tiers:[{bbox,minzoom?,maxzoom}]}, terrain:{...}, landcover:{tiers:[{bbox,minzoom,maxzoom,master?}],format?,speckHa?}, bbox:[w,s,e,n], routes:[{id,label,color,waypoints:[[lng,lat,name?],...]}] }
// Looked up as work/trips/<slug>/map.json, then scripts/maps/<slug>.json. Coordinates are WGS-84 throughout.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
const flag = name => args.includes(`--${name}`);
if (!target) { console.error('usage: build-trip-map.mjs <slug|map.json> [--extract] [--dry-run] [--landcover] [--routes] [--validate]'); process.exit(1); }

const root = resolve(import.meta.dirname, '..');
const configPath = [target, `${root}/work/trips/${target}/map.json`, `${root}/scripts/maps/${target}.json`].find(p => p.endsWith('.json') ? existsSync(p) : false);
if (!configPath) { console.error(`no map.json for "${target}"`); process.exit(1); }
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const slug = configPath.endsWith('/map.json') ? basename(resolve(configPath, '..')) : basename(configPath, '.json');
const outDir = `${root}/public/trips/${slug}/map`;
const bin = process.env.PMTILES || 'pmtiles';
// Each layer is one or more tiers { bbox | corridor, minzoom?, maxzoom }: a wide low-zoom tier keeps the overview free of blank edges,
// a narrow high-zoom tier keeps the file small. Tiers must not overlap in zoom (pmtiles merge needs disjoint archives).
// corridor: <km> replaces bbox with a strip of that half-width around public/trips/<slug>/map/routes.geojson (run --routes first).
// shortcut: the strip is a chain of overlapping squares, so it is up to ~40% wider at diagonals; switch to a real buffer if size matters.
// Optional on a corridor tier: clip [w,s,e,n] keeps only route vertices inside it; bbox is added to the strip as one more rectangle.
function corridorRegion(km, file, tier = {}) {
  const routes = JSON.parse(readFileSync(`${outDir}/routes.geojson`, 'utf8'));
  const boxes = [];
  for (const f of routes.features) {
    let last;
    for (const [lng, lat] of f.geometry.coordinates) {
      if (tier.clip && (lng < tier.clip[0] || lng > tier.clip[2] || lat < tier.clip[1] || lat > tier.clip[3])) continue;
      const dLat = km / 111, dLng = km / (111 * Math.cos(lat * Math.PI / 180));
      if (last && Math.abs(lng - last[0]) < dLng * 0.8 && Math.abs(lat - last[1]) < dLat * 0.8) continue;
      last = [lng, lat];
      boxes.push([[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]]);
    }
  }
  if (tier.bbox) { const [w, s, e, n] = tier.bbox; boxes.push([[[w, s], [e, s], [e, n], [w, n], [w, s]]]); }
  writeFileSync(file, JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: boxes } }));
  return file;
}
const plan = [['base', config.base], ['terrain', config.terrain]].map(([name, src]) => {
  const tiers = src.tiers ?? [{ bbox: config.bbox, maxzoom: src.maxzoom }];
  const out = `${outDir}/${name}.pmtiles`;
  const parts = tiers.map((t, i) => ({ out: tiers.length > 1 ? `${out}.tier${i}` : out, argv: ['extract', src.url, tiers.length > 1 ? `${out}.tier${i}` : out, t.corridor ? `--region=${corridorRegion(t.corridor, `${out}.region${i}.json`, t)}` : `--bbox=${t.bbox.join(',')}`, ...(t.minzoom != null ? [`--minzoom=${t.minzoom}`] : []), `--maxzoom=${t.maxzoom}`, ...(flag('dry-run') ? ['--dry-run'] : [])] }));
  return { name, out, parts };
});

// Land cover: WorldCover is generalised and coloured by scripts/build-landcover.py (uv brings rasterio/numpy/scipy/pillow), written as MBTiles, then converted.
const lcMbtiles = `${root}/work/cache/landcover-${slug}.mbtiles`;
const lcArgv = ['run', '--with', 'rasterio', '--with', 'numpy', '--with', 'scipy', '--with', 'pillow', `${root}/scripts/build-landcover.py`, configPath, lcMbtiles, `${root}/work/cache/worldcover`];
if (flag('landcover')) {
  if (!config.landcover) { console.error(`${configPath} has no "landcover" block`); process.exit(1); }
  mkdirSync(`${root}/work/cache/worldcover`, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  rmSync(`${outDir}/landcover.pmtiles`, { force: true });
  for (const { out, parts } of plan) parts.forEach((_, i) => rmSync(`${out}.region${i}.json`, { force: true }));
  console.log(`uv ${lcArgv.join(' ')}`);
  execFileSync('uv', lcArgv, { stdio: 'inherit' });
  execFileSync(bin, ['convert', lcMbtiles, `${outDir}/landcover.pmtiles`], { stdio: 'inherit' });
  process.exit(0);
}

for (const { name, out, parts } of plan) {
  if (!flag('extract')) { if (!flag('routes') && !flag('validate')) parts.forEach(p => console.log(`${bin} ${p.argv.join(' ')}`)); continue; }
  mkdirSync(outDir, { recursive: true });
  for (const p of parts) { console.log(`${name}: ${bin} ${p.argv.join(' ')}`); execFileSync(bin, p.argv, { stdio: 'inherit' }); }
  if (parts.length > 1 && !flag('dry-run')) {
    rmSync(out, { force: true });
    execFileSync(bin, ['merge', ...parts.map(p => p.out), out], { stdio: 'inherit' });
    parts.forEach(p => rmSync(p.out));
  }
}
for (const { out, parts } of plan) parts.forEach((_, i) => rmSync(`${out}.region${i}.json`, { force: true }));
if (!flag('extract') && config.landcover && !flag('routes') && !flag('validate')) console.log(`uv ${lcArgv.join(' ')}\n${bin} convert ${lcMbtiles} ${outDir}/landcover.pmtiles   # --landcover runs both`);

// Backtracking: consecutive segments already driven in the opposite direction (>200 m) mean a dead-end spur.
function backtrack(line) {
  const seen = new Set();
  let run = 0, worst = 0, at = null;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    if (seen.has(`${b}>${a}`)) {
      run += Math.hypot((b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180), b[1] - a[1]) * 111320;
      if (run > worst) { worst = run; at = b; }
    } else run = 0;
    seen.add(`${a}>${b}`);
  }
  return [worst, at];
}

if (flag('validate')) {
  for (const f of JSON.parse(readFileSync(`${outDir}/routes.geojson`, 'utf8')).features) {
    const [worst, at] = backtrack(f.geometry.coordinates);
    console.log(`${f.properties.id}: ${f.geometry.coordinates.length} points, retrace ${Math.round(worst)} m${worst > 200 ? ` near ${at}` : ''}`);
  }
  process.exit(0);
}

if (flag('routes')) {
  mkdirSync(outDir, { recursive: true });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const features = [];
  for (const route of config.routes) {
    const coords = route.waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=false`;
    const res = await fetch(url, { headers: { 'User-Agent': 'travel-journal-map-build/1.0 (personal non-commercial roadbook)' } });
    const json = await res.json();
    if (!res.ok || json.code !== 'Ok') throw new Error(`OSRM failed for ${route.id}: ${res.status} ${json.code} ${json.message ?? ''}`);
    // Spur check: a waypoint off the road makes OSRM drive to the nearest road point and back.
    json.waypoints.forEach((w, i) => {
      if (w.distance > 300) console.warn(`WARNING ${route.id}: waypoint "${route.waypoints[i][2] ?? i}" is ${Math.round(w.distance)} m from the road OSRM snapped it to; move it onto the real road (Overpass / OSRM /nearest).`);
    });
    const line = [];
    for (const [lng, lat] of json.routes[0].geometry.coordinates) {
      const p = [+lng.toFixed(5), +lat.toFixed(5)];
      const last = line.at(-1);
      if (!last || last[0] !== p[0] || last[1] !== p[1]) line.push(p);
    }
    const [worst, at] = backtrack(line);
    if (worst > 200) console.warn(`WARNING ${route.id}: route retraces itself for ~${Math.round(worst)} m near ${at} (dead-end spur); check the waypoints around it.`);
    features.push({ type: 'Feature', properties: { id: route.id, label: route.label, color: route.color ?? 0, km: Math.round(json.routes[0].distance / 1000) }, geometry: { type: 'LineString', coordinates: line } });
    console.log(`${route.id}: ${Math.round(json.routes[0].distance / 1000)} km, ${line.length} points`);
    await sleep(1100);
  }
  writeFileSync(`${outDir}/routes.geojson`, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`wrote ${outDir}/routes.geojson`);
}
