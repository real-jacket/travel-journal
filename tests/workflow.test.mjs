import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, mkdtemp, copyFile, readdir, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trips, getFeaturedTrip, renderTripLinks } from "../src/data/trips.js";
import { createTripDraft } from "../scripts/new-trip.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

test("真实清单遵守新增旅行字段、唯一ID和安全资源路径约定", async () => {
  const template = JSON.parse(await readFile(path.join(projectRoot, "templates/trip-entry.json"), "utf8"));
  assert.ok(trips.length > 0);
  assert.equal(new Set(trips.map((trip) => trip.id)).size, trips.length);
  for (const trip of trips) {
    assert.match(trip.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const field of Object.keys(template).filter((key) => !["route", "tags", "imageSource"].includes(key))) {
      assert.equal(typeof trip[field], "string", `${trip.id}.${field}`);
      assert.ok(trip[field].trim(), `${trip.id}.${field} is required`);
    }
    assert.equal(trip.statusLabel, { planned: "计划中", archived: "历史路书" }[trip.status]);
    assert.match(trip.date, /^\d{4}[.年-]/);
    for (const [field, minimum] of [["route", 2], ["tags", 1]]) {
      assert.ok(Array.isArray(trip[field]) && trip[field].length >= minimum);
      assert.ok(trip[field].every((value) => typeof value === "string" && value.trim()));
    }
    assert.equal(trip.path, `trips/${trip.id}/`);
    assert.match(trip.image, /^images\/[a-z0-9_-]+\.(webp|png|jpe?g|avif)$/i);
    assert.equal(typeof trip.imageSource, "string", `${trip.id}.imageSource`);
    if (trip.imageSource) assert.ok(["https:", "http:"].includes(new URL(trip.imageSource).protocol));
  }
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

test("无JS入口覆盖第三份路书，标题和属性正确转义", () => {
  const html = renderTripLinks([
    { title: "旧路书", path: "trips/old/" },
    { title: '河谷 & <森林> "摄影"', path: "trips/new-2027/" },
    { title: "第三份", path: "trips/third/" },
  ]);
  assert.ok(html.includes('href="./trips/new-2027/"'));
  assert.ok(html.includes("河谷 &amp; &lt;森林&gt; &quot;摄影&quot;"));
  assert.ok(html.includes('href="./trips/third/"'));
  assert.ok(!html.includes("<森林>"));
  assert.equal(renderTripLinks([]), "");
});

async function draftWorkspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), "travel-journal-workflow-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(["src/data", "templates", "public/trips/existing-page"].map((directory) => mkdir(path.join(root, directory), { recursive: true })));
  await writeFile(path.join(root, "package.json"), '{"type":"module"}');
  await writeFile(path.join(root, "src/data/trips.js"), 'export const trips = [{ id: "registered" }];');
  await Promise.all(["trip-entry.json", "trip-brief.md"].map((name) => copyFile(path.join(projectRoot, "templates", name), path.join(root, "templates", name))));
  return root;
}

test("草稿命令生成唯一两文件，设定接入路径，保持公开目录不变", async (t) => {
  const root = await draftWorkspace(t);
  const destination = await createTripDraft(root, "yunnan-2027");
  assert.equal(path.relative(root, destination), "work/trips/yunnan-2027");
  assert.deepEqual((await readdir(destination)).sort(), ["brief.md", "entry.json"]);
  const entry = JSON.parse(await readFile(path.join(destination, "entry.json"), "utf8"));
  assert.equal(entry.id, "yunnan-2027");
  assert.equal(entry.path, "trips/yunnan-2027/");
  assert.equal(entry.image, "images/yunnan-2027.webp");
  assert.ok(!(await readFile(path.join(destination, "brief.md"), "utf8")).includes("@@SLUG@@"));
  assert.deepEqual(await readdir(path.join(root, "public/trips")), ["existing-page"]);
  await assert.rejects(() => createTripDraft(root, "yunnan-2027"), { code: "EEXIST" });
  assert.equal(JSON.parse(await readFile(path.join(destination, "entry.json"), "utf8")).id, "yunnan-2027");
});

test("草稿命令拒绝非法ID、已注册计划和已存在路书，不写入新文件", async (t) => {
  const root = await draftWorkspace(t);
  for (const slug of ["", "../escape", "Yunnan", "test/child", "double--dash", "registered", "existing-page"]) {
    await assert.rejects(() => createTripDraft(root, slug));
  }
  await assert.rejects(() => access(path.join(root, "work")), { code: "ENOENT" });
});
