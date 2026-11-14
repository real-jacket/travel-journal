import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateTrip } from "../src/data/trip-schema.js";

const url = "https://host.example/trip-x/trip.json";
const json = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const example = await json("../docs/examples/trip.json");
const reject = (patch, pattern) => assert.throws(() => validateTrip({ ...example, ...patch }, url), pattern);

test("示例清单通过校验，并解析相对封面", () => {
  const trip = validateTrip(example, url);
  assert.equal(trip.image, "https://host.example/trip-x/cover.webp");
  assert.equal(trip.url, "https://example.com/my-trip-article");
  assert.ok(!("extra" in validateTrip({ ...example, extra: 1 }, url)));
});

test("缺省 url 为清单所在目录，绝对封面保持不变", () => {
  const { url: _omit, ...rest } = example;
  const trip = validateTrip({ ...rest, image: "https://cdn.example/c.png" }, url);
  assert.equal(trip.url, "https://host.example/trip-x/");
  assert.equal(trip.image, "https://cdn.example/c.png");
});

test("每条规则各有一个拒绝用例，错误信息含字段与清单地址", () => {
  reject({ imageCredit: "" }, new RegExp(`${url}: imageCredit`));
  reject({ status: "done" }, /status/);
  reject({ id: "Bad_Id" }, /id/);
  reject({ id: 5 }, /id/);
  reject({ date: "明年春天" }, /date/);
  reject({ route: ["only"] }, /route/);
  reject({ tags: [] }, /tags/);
  reject({ title: "长".repeat(301) }, /title/);
  reject({ url: "http://example.com/" }, /url/);
  reject({ url: "javascript:alert(1)" }, /url/);
  reject({ image: "data:image/png;base64,AAAA" }, /image/);
  reject({ image: "http://host.example/c.webp" }, /image/);
  reject({ imageSource: "http://example.com/" }, /imageSource/);
  assert.throws(() => validateTrip([], url), /manifest/);
});

test("trips.json 是唯一 https 清单地址数组", async () => {
  const urls = await json("../trips.json");
  assert.ok(Array.isArray(urls) && urls.length > 0);
  assert.equal(new Set(urls).size, urls.length);
  for (const item of urls) assert.equal(new URL(item).protocol, "https:");
});
