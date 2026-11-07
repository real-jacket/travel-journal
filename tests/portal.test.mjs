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
