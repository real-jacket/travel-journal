import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export async function createTripDraft(root, slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "")) throw new Error("旅行ID只允许小写字母、数字和连字符，例如 yunnan-2027。");
  const { trips } = await import(pathToFileURL(path.join(root, "src/data/trips.js")));
  if (trips.some((trip) => trip.id === slug)) throw new Error(`旅行 ${slug} 已在清单中，不覆盖现有项目。`);
  try {
    await access(path.join(root, "public/trips", slug));
    throw new Error(`旅行目录 ${slug} 已存在，不覆盖现有路书。`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const entry = JSON.parse(await readFile(path.join(root, "templates/trip-entry.json"), "utf8"));
  const brief = await readFile(path.join(root, "templates/trip-brief.md"), "utf8");
  entry.id = slug;
  entry.path = `trips/${slug}/`;
  entry.image = `images/${slug}.webp`;
  const parent = path.join(root, "work/trips");
  const destination = path.join(parent, slug);
  await mkdir(parent, { recursive: true });
  await mkdir(destination);
  await writeFile(path.join(destination, "entry.json"), `${JSON.stringify(entry, null, 2)}\n`, { flag: "wx" });
  await writeFile(path.join(destination, "brief.md"), brief.replaceAll("@@SLUG@@", slug), { flag: "wx" });
  return destination;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2).filter((arg) => arg !== "--"); // pnpm may forward a literal "--"
    if (args.length !== 1) throw new Error("用法：pnpm trip:new <slug>");
    const destination = await createTripDraft(projectRoot, args[0]);
    console.log(`旅行草稿已创建：${path.relative(projectRoot, destination)}/\n填写 brief.md 和 entry.json，再按 docs/add-a-trip.md 接入。草稿不会发布。`);
  } catch (error) {
    console.error(error.code === "EEXIST" ? "草稿已存在，请继续编辑原草稿；未覆盖任何文件。" : error.message);
    process.exitCode = 1;
  }
}
