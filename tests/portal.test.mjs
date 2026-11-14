import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { trips, filterTrips, getFeaturedTrip, renderTripLinks } from "../src/data/trips.js";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const ids = (items) => items.map((trip) => trip.id);

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

test("同步后的清单非空、ID唯一，链接与封面为绝对 https 地址", () => {
  assert.ok(trips.length > 0);
  assert.equal(new Set(ids(trips)).size, trips.length);
  for (const trip of trips) for (const field of ["url", "image"]) assert.equal(new URL(trip[field]).protocol, "https:", `${trip.id}.${field}`);
});

test("推荐跟随第一个计划中项目，归档后回退，不依赖年份或项目数量", () => {
  const past = { id: "past", status: "archived" };
  const next = { id: "next-2027", status: "planned" };
  const later = { id: "later", status: "planned" };
  assert.equal(getFeaturedTrip([past, next, later]), next);
  assert.equal(getFeaturedTrip([later, next, past]), later);
  assert.equal(getFeaturedTrip([past]), past);
  assert.equal(getFeaturedTrip([]), undefined);
});

test("无JS入口使用绝对路书地址，标题和属性正确转义", () => {
  const html = renderTripLinks([
    { title: "旧路书", url: "https://a.example/old/" },
    { title: '河谷 & <森林> "摄影"', url: 'https://b.example/x?a=1&b="2"' },
  ]);
  assert.ok(html.includes('href="https://a.example/old/"'));
  assert.ok(html.includes('href="https://b.example/x?a=1&amp;b=&quot;2&quot;"'));
  assert.ok(html.includes("河谷 &amp; &lt;森林&gt; &quot;摄影&quot;"));
  assert.ok(!html.includes("<森林>"));
  assert.equal(renderTripLinks([]), "");
});

test("旧路书地址是跳转页，指向新站点并保留查询与锚点", async () => {
  for (const slug of ["anhui", "khingan"]) {
    const html = await readFile(path.join(publicRoot, `trips/${slug}/index.html`), "utf8");
    const target = `https://real-jacket.github.io/trip-${slug}/`;
    assert.ok(html.includes(`<link rel="canonical" href="${target}">`));
    assert.ok(html.includes(`<meta http-equiv="refresh" content="0; url=${target}">`));
    assert.ok(html.includes(`location.replace("${target}" + location.search + location.hash)`));
    assert.ok(html.includes(`<a href="${target}">`));
  }
});

test("public/ 只放小文件，不含 PMTiles", async () => {
  for (const file of await filesIn(publicRoot)) {
    assert.notEqual(path.extname(file), ".pmtiles", file);
    assert.ok((await stat(file)).size <= 1024 * 1024, `${file} 超过 1 MB`);
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
