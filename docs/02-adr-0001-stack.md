# ADR-0001：首版技术栈——Next.js 全栈单服务 + SQLite（可迁移 Postgres）

状态：已采纳（2026-10-20）

## 背景

PRD 默认栈：Next.js 前端 + FastAPI 后端 + PostgreSQL/pgvector + Redis + 对象存储。总开发指令允许"环境不支持时先给出替代及理由"。

本机环境：Node 25 / npm 11 就绪；Python 仅系统 3.9（过旧）；无本地 PostgreSQL / Redis / S3。目标是在无外部付费服务的前提下交付可运行、数据真实持久化的 P0 闭环。

## 决定

- **单服务 Next.js（App Router）+ TypeScript + Tailwind**：前端页面与 API Route Handlers 同进程。PRD 明确允许"纯 TS：Next.js Route Handlers"。
- **SQLite（better-sqlite3）**：WAL 模式，所有表带 `user_id` 租户隔离；schema 命名与类型对齐 PRD 数据模型，后续可迁移 PostgreSQL。
- **检索**：SQLite FTS5 关键词检索 + 服务端排序；预留 `embedding` BLOB 列，配置 Embedding API 后升级为向量+关键词混合检索（pgvector 路径不变）。
- **模型网关**：`src/lib/llm.ts` 统一封装 OpenAI 兼容 Chat Completions（`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`，默认兼容 Moonshot/Kimi、OpenAI、DeepSeek 等任意 OpenAI 兼容端点），强制 JSON 输出 + zod 校验；未配置即 503，不造假。
- **文件存储**：源文件存 `data/uploads/<user_id>/`，元数据入库；接口按可替换 S3 设计。
- **异步**：解析/生成任务为 `jobs` 表 + 服务端后台执行，前端轮询真实状态；不引入 Redis（单进程内足够，接口预留队列替换点）。
- **认证**：邮箱+密码（scrypt 哈希）+ HttpOnly 会话 Cookie（`sessions` 表）。Supabase Auth 为后续替换项。

## 后果

- 一条命令（`npm run dev`）即可运行完整平台；零外部服务依赖（除 LLM API）。
- 多实例水平扩展、视频渲染队列、pgvector 语义检索推迟到 P1/P2，届时按 ADR-0002 迁移。
- tldraw 商用许可不明确 → 白板选用 Excalidraw（MIT）路线，P1 实现。
