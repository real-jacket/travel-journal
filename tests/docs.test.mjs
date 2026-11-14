import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const skip = new Set(["node_modules", "work", "dist", ".git"]);

async function markdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const groups = await Promise.all(entries.filter((entry) => !skip.has(entry.name)).map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? markdown(file) : /\.md$/i.test(entry.name) ? [file] : [];
  }));
  return groups.flat();
}

test("Markdown 文档中的相对链接都指向存在的文件", async () => {
  const files = [
    ...["README.md", "AGENTS.md"].map((name) => path.join(root, name)),
    ...(await Promise.all(["docs", "skills", ".github"].map((name) => markdown(path.join(root, name))))).flat(),
  ];
  const broken = [];
  for (const file of files) {
    const text = (await readFile(file, "utf8")).replace(/```[\s\S]*?```/g, "");
    for (const [, raw] of text.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(raw)) continue;
      const target = decodeURIComponent(raw.split("#")[0].split("?")[0]);
      if (!target) continue;
      const resolved = target.startsWith("/") ? path.join(root, target) : path.resolve(path.dirname(file), target);
      if (!(await access(resolved).then(() => true, () => false))) broken.push(`${path.relative(root, file)} -> ${raw}`);
    }
  }
  assert.deepEqual(broken, []);
});
