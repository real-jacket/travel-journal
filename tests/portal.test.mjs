import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
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
  assert.deepEqual(ids(filterTrips(trips)), ["anhui", "khingan"]);
  assert.deepEqual(ids(filterTrips(trips, "", "planned")), ["anhui"]);
  assert.deepEqual(ids(filterTrips(trips, "", "archived")), ["khingan"]);
  assert.deepEqual(ids(filterTrips(trips, "方塘")), ["anhui"]);
  assert.deepEqual(ids(filterTrips(trips, "阿尔山")), ["khingan"]);
  assert.deepEqual(ids(filterTrips(trips, "  方塘　电车　晨雾  ")), ["anhui"]);
  assert.deepEqual(ids(filterTrips(trips, "阿尔山 柴河", "archived")), ["khingan"]);
  assert.deepEqual(ids(filterTrips(trips, "２０２６．１１")), ["anhui"]);
  assert.deepEqual(ids(filterTrips(trips, "方塘 柴河")), []);
  assert.deepEqual(ids(filterTrips(trips, "方塘", "archived")), []);
  assert.deepEqual(ids(filterTrips(trips, "不存在的目的地")), []);
});

test("两份完整路书和封面存在，内联脚本可解析并可返回首页", async () => {
  for (const trip of trips) {
    assert.match(trip.path, /^trips\/[a-z]+\/$/);
    const file = path.join(publicRoot, trip.path, "index.html");
    await nonempty(file);
    await nonempty(path.join(publicRoot, trip.image));
    const html = await readFile(file, "utf8");
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /href=["']\.\.\/\.\.\/["']/);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    let checkedScripts = 0;
    for (const [, attributes, body] of scripts) {
      if (/\bsrc\s*=/.test(attributes) || /\btype\s*=\s*["']application\/json/.test(attributes)) continue;
      assert.doesNotThrow(() => new vm.Script(body, { filename: file }));
      checkedScripts += 1;
    }
    assert.ok(checkedScripts >= 1, `${trip.id} must check executable inline scripts`);
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
    if (path.extname(file) === ".html") assert.doesNotMatch(await readFile(file, "utf8"), forbidden);
  }
});
