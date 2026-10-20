# LearnLoop — AI 智能学习工作台

对标 Hyperknow 公开功能的**原创实现**（不使用其商标、素材与私有代码）。从「提出学习目标」到「学会并能迁移应用」的完整闭环：学习目标 → 资料摄取 → 水平诊断 → 课程生成 → AI 教师授课 → 测验批改 → 错因补救 → 掌握度记忆 → 复习与计划。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填入 LLM_API_KEY（任意 OpenAI 兼容端点，默认 Moonshot/Kimi）
npm run dev                  # http://localhost:3000
```

未配置 `LLM_API_KEY` 时平台照常运行，所有 AI 接口返回 `503 LLM_NOT_CONFIGURED` 并显示配置指引——**没有任何假数据或预写回复**。

## 技术栈

Next.js (App Router) + TypeScript + Tailwind · better-sqlite3 (WAL, FTS5-trigram) · scrypt 会话认证 · OpenAI 兼容模型网关（zod 契约校验 + token 用量记录）。架构取舍见 `docs/02-adr-0001-stack.md`。

## 文档

- `docs/01-gap-analysis.md` — F01–F26 功能差距表
- `docs/02-adr-0001-stack.md` — 技术栈 ADR
- `docs/03-data-model.md` — 数据库设计（21 表）
- `docs/04-task-list.md` — P0 任务清单与 LLM JSON 契约
- `docs/05-sprint-1-report.md` — Sprint 1 验证结果、覆盖率、已知缺陷、P1 计划

## 测试夹具

`node scripts/fixtures/generate.mjs` 生成中文 sample.pdf / sample.docx / sample.pptx 用于上传解析验证。
