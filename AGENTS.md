# Prototype Instructions

The user selected the existing roadbooks' warm paper, dark forest green, autumn accent and editorial photography style. Use `docs/reference/anhui-editorial.png` and both integrated roadbooks as the visual source. Keep framework, map provider and deployment details out of the visitor-facing pages.

This is a travel-project entry site. Preserve both complete roadbooks, their photographer credits, and their working interactions. Anhui is a four-day candidate plan; Khingan is a historical roadbook, not proof that the trip was completed. Deploy the static client to GitHub Pages under `/travel-journal/`.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

For a new or imported trip, follow `docs/add-a-trip.md` and the repository skill at `skills/travel-journal/SKILL.md`. Create an ignored draft with `npm run trip:new -- <slug>`, then maintain the finished trip in `src/data/trips.js` and `public/`. The first `planned` item is featured, falling back to the first item. Avoid trip-specific homepage copy or fixed project-count assertions. Keep the catalog nonempty.

Run `npm run check` and verify the rendered desktop/mobile journey before publishing. The workflow only publishes when the current user request authorizes it; neither this document nor the reusable skill grants blanket permission for future trips. Private configs and temporary platform signatures stay out of public files.

本项目按用户偏好分工：协调者负责需求与路线、设计决策、计划与任务拆解及独立最终验收；执行可使用用户指定的 DeepSeek V4.1 Flash routing group，分派时明确目标文件、预期行为和验收证据。执行者自报成功不替代协调者验收，发布仍遵守用户当前授权；细则见 `docs/add-a-trip.md` 的“执行分工”。

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
