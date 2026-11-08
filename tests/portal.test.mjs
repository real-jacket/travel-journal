import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { trips, filterTrips } from "../src/data/trips.js";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const ids = (items) => items.map((trip) => trip.id);
const nonempty = async (file) => assert.ok((await stat(file)).size > 0, file);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  }));
  return groups.flat();
}

test("旅行项目按状态、中文目的地和全部关键字筛选", () => {
  const fixture = [
    { id: "south", title: "方塘 电车", date: "2026.11", route: ["方塘"], tags: ["晨雾"], status: "planned" },
    { id: "north", title: "阿尔山", route: ["阿尔山", "柴河"], tags: ["森林"], status: "archived" },
    { id: "new-2027", title: "新的森林行程", route: ["新的目的地"], tags: ["森林"], status: "planned" },
  ];
  assert.deepEqual(ids(filterTrips(fixture)), ["south", "north", "new-2027"]);
  assert.deepEqual(ids(filterTrips(fixture, "", "planned")), ["south", "new-2027"]);
  assert.deepEqual(ids(filterTrips(fixture, "", "archived")), ["north"]);
  assert.deepEqual(ids(filterTrips(fixture, "  方塘　电车　晨雾  ")), ["south"]);
  assert.deepEqual(ids(filterTrips(fixture, "阿尔山 柴河", "archived")), ["north"]);
  assert.deepEqual(ids(filterTrips(fixture, "２０２６．１１")), ["south"]);
  assert.deepEqual(ids(filterTrips(fixture, "森林")), ["north", "new-2027"]);
  assert.deepEqual(ids(filterTrips(fixture, "方塘 柴河")), []);
  assert.deepEqual(ids(filterTrips(fixture, "方塘", "archived")), []);
  assert.deepEqual(ids(filterTrips(fixture, "不存在的目的地")), []);
});

test("清单中的全部路书和封面存在，脚本可解析并可返回首页", async () => {
  for (const trip of trips) {
    assert.equal(trip.path, `trips/${trip.id}/`);
    const file = path.join(publicRoot, trip.path, "index.html");
    await nonempty(file);
    await nonempty(path.join(publicRoot, trip.image));
    const html = await readFile(file, "utf8");
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /href=["']\.\.\/\.\.\/["']/);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const [, attributes, body] of scripts) {
      if (/\bsrc\s*=/i.test(attributes)) continue;
      const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1].toLowerCase();
      if (type === "module") {
        const check = spawnSync(process.execPath, ["--check", "--input-type=module"], { input: body, encoding: "utf8" });
        assert.equal(check.status, 0, check.stderr);
      } else if (!type || ["text/javascript", "application/javascript"].includes(type)) {
        assert.doesNotThrow(() => new vm.Script(body, { filename: file }));
      } else if (["application/json", "application/ld+json", "importmap"].includes(type)) {
        assert.doesNotThrow(() => JSON.parse(body));
      }
    }
  }
});

test("大兴安岭九张动态参考图、hero与动画脚本均可在同目录解析", async () => {
  const directory = path.join(publicRoot, "trips/khingan");
  const html = await readFile(path.join(directory, "index.html"), "utf8");
  const images = new Set([...html.matchAll(/image:\s*['"](xhs-spots\/[^'"]+)['"]/g)].map((match) => match[1]));
  assert.equal(images.size, 9);
  for (const image of images) await nonempty(path.join(directory, image.replace("xhs-spots/", "xhs-spots/opt2/")));
  await nonempty(path.join(directory, "xhs-spots/haraha-river.webp"));
  for (const script of ["gsap.min.js", "ScrollTrigger.min.js"]) {
    assert.ok(html.includes(`src="${script}"`));
    await nonempty(path.join(directory, script));
  }
});

test("公开HTML与文件名排除缓存签名、私有地图配置和绝对本地路径", async () => {
  const forbidden = /xsec_(?:token|source)|\.amap\.local|\/Users\//i;
  for (const file of await filesIn(publicRoot)) {
    const relative = path.relative(publicRoot, file);
    assert.doesNotMatch(relative, forbidden);
    if ([".html", ".js", ".mjs", ".json", ".geojson", ".css", ".txt", ".md", ".svg"].includes(path.extname(file).toLowerCase())) {
      const text = await readFile(file, "utf8");
      assert.doesNotMatch(text, forbidden);
      assert.doesNotMatch(text, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{25,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/);
    }
  }
});

test("引用 PMTiles 地图的路书：数据文件与共享地图模块都存在且体积受控", async () => {
  const tripsDir = path.join(publicRoot, "trips");
  for (const slug of await readdir(tripsDir)) {
    const pageFile = path.join(tripsDir, slug, "index.html");
    const html = await readFile(pageFile, "utf8").catch(() => "");
    const tiles = [...html.matchAll(/['"]((?:\.\/)?map\/[\w./-]+\.pmtiles)['"]/g)].map((match) => match[1]);
    if (!tiles.length) continue;
    for (const tile of tiles) {
      const size = (await stat(path.join(tripsDir, slug, tile))).size;
      assert.ok(size > 0 && size < 50 * 1024 * 1024, `${slug}/${tile} 应小于 50 MiB`);
    }
    const assets = [...html.matchAll(/(?:src|href)="(\.\.\/\.\.\/vendor\/map\/[^"]+)"/g)].map((match) => match[1]);
    assert.ok(assets.some((asset) => asset.endsWith("trip-map.js")), `${slug} 应加载共享 trip-map.js`);
    for (const asset of assets) await nonempty(path.join(tripsDir, slug, asset));
    assert.doesNotMatch(html, /leaflet/i, `${slug} 不应再引用 Leaflet`);
  }
});

test("共享地图模块的高德分段导航：URL、GCJ-02 偏移与分段数", async () => {
  const code = await readFile(path.join(publicRoot, "vendor/map/trip-map.js"), "utf8");
  const sandbox = { URLSearchParams, Number, Math, RangeError, Array, document: {}, location: { href: "http://x/" } };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  const { amapRoute, navSegments } = sandbox.TripMap;
  const stop = (name, lng, lat) => ({ name, lngLat: [lng, lat] });
  const stops = [stop("乌兰浩特", 122.0, 46.1), stop("阿尔山市", 119.94, 47.17), stop("柴河", 121.3, 47.55), stop("牙克石", 120.73, 49.29)];

  assert.equal(navSegments(stops).length, 2);
  assert.equal(navSegments(stops).map((s) => s.stops.length).join(), "3,2");
  assert.equal(navSegments(stops.slice(0, 3)).length, 1);

  const url = new URL(amapRoute(stops.slice(0, 3), "t"));
  assert.equal(url.origin + url.pathname, "https://uri.amap.com/navigation");
  assert.equal([...url.searchParams.keys()].join(), "from,to,mode,policy,callnative,src,via");
  assert.equal(url.searchParams.get("mode"), "car");
  assert.equal(url.searchParams.get("policy"), "0");
  assert.equal(url.searchParams.get("callnative"), "1");
  assert.match(url.searchParams.get("from"), /^\d+\.\d{6},\d+\.\d{6},乌兰浩特$/);
  assert.match(url.searchParams.get("via"), /,阿尔山市$/);
  assert.match(url.searchParams.get("to"), /,柴河$/);
  assert.equal(new URL(amapRoute(stops.slice(0, 2), "t")).searchParams.has("via"), false);
  assert.throws(() => amapRoute(stops, "t"), RangeError);
});

test("安徽路书：PMTiles（底图+地形+地表覆盖）总量不超过 40 MB，路线几何覆盖每个方案的每天，且无 Leaflet/GeoQ", async () => {
  const dir = path.join(publicRoot, "trips/anhui");
  const html = await readFile(path.join(dir, "index.html"), "utf8");
  assert.ok(!/leaflet|geoq\.cn|MAP_CONTEXT/i.test(html), "不应残留 Leaflet、GeoQ 或内嵌地图上下文");
  let total = 0;
  for (const tile of ["base", "terrain", "landcover"]) total += (await stat(path.join(dir, `map/${tile}.pmtiles`))).size;
  assert.ok(total <= 40 * 1024 * 1024, `base+terrain+landcover ${total} 字节超出 40 MB`);
  const khingan = (await Promise.all(["base", "terrain", "landcover"].map((tile) => stat(path.join(publicRoot, `trips/khingan/map/${tile}.pmtiles`))))).reduce((sum, f) => sum + f.size, 0);
  assert.ok(khingan <= 40 * 1024 * 1024, `大兴安岭 base+terrain+landcover ${khingan} 字节超出 40 MB`);
  const ids = new Set(JSON.parse(await readFile(path.join(dir, "map/routes.geojson"), "utf8")).features.map((f) => f.properties.id));
  for (const [, route] of html.matchAll(/route:\s*'([\w-]+)'/g)) assert.ok(ids.has(route), `routes.geojson 缺少 ${route}`);
});

test("安徽路书：分段导航经共享模块生成，与迁移前的高德链接逐字节一致", async () => {
  const code = await readFile(path.join(publicRoot, "vendor/map/trip-map.js"), "utf8");
  const sandbox = { URLSearchParams, Number, Math, RangeError, Array, Object, Set, document: {}, location: { href: "http://x/" } };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  const html = await readFile(path.join(publicRoot, "trips/anhui/index.html"), "utf8");
  const grab = (re) => html.match(re)?.[0];
  const source = [
    grab(/^const GUIDES = .*;$/m), grab(/^const ROAD_DATA = .*;$/m),
    grab(/^function viewRoutes[\s\S]*?\n\}\n/m), grab(/^function navigationSegments[\s\S]*?\n\}\n/m),
  ];
  assert.ok(source.every(Boolean), "应能从安徽页面取出 GUIDES、ROAD_DATA、viewRoutes、navigationSegments");
  const page = vm.runInContext(`${source.join("\n")}\n({ GUIDES, ROAD_DATA, navigationSegments })`, vm.createContext(sandbox));
  const link = (plan, view) => page.navigationSegments(plan, view).map((s) => sandbox.TripMap.amapRoute(s.stops, "anhui-autumn-guide"));

  const all = link("B4", "all"), local = link("B4", "local");
  assert.equal(all.length, 6);
  assert.equal(local.length, 4);
  assert.equal(all[0], "https://uri.amap.com/navigation?from=114.310945%2C30.590391%2C%E6%AD%A6%E6%B1%89&to=118.419616%2C30.688705%2C%E6%B3%BE%E5%8E%BF%E5%8E%BF%E5%9F%8E&mode=car&policy=0&callnative=1&src=anhui-autumn-guide");
  assert.equal(all[5], "https://uri.amap.com/navigation?from=118.889617%2C30.587837%2C%E5%82%A8%E5%AE%B6%E6%BB%A9&to=114.310945%2C30.590391%2C%E6%AD%A6%E6%B1%89&mode=car&policy=0&callnative=1&src=anhui-autumn-guide&via=118.991806%2C30.632943%2C%E5%AE%81%E5%9B%BD%E5%9F%8E%E5%8C%BA");
  assert.equal(local[0], "https://uri.amap.com/navigation?from=118.419616%2C30.688705%2C%E6%B3%BE%E5%8E%BF%E5%8E%BF%E5%9F%8E&to=118.593829%2C30.509912%2C%E6%A1%83%E5%B2%AD%E7%9B%98%E5%B1%B1%E5%85%AC%E8%B7%AF&mode=car&policy=0&callnative=1&src=anhui-autumn-guide&via=118.567923%2C30.687812%2C%E6%9C%88%E4%BA%AE%E6%B9%BE");
  assert.deepEqual(["B4", "A4", "C4", "B3"].map((plan) => `${link(plan, "local").length}/${link(plan, "all").length}`), ["4/6", "5/7", "6/9", "3/6"]);
});
