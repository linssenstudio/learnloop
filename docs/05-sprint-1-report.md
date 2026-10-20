# Sprint 1 报告 — P0「能独立用起来的 AI 学习工作台」

日期：2026-10-20。范围：Wave 1–4（docs/04-task-list.md）。

## 运行方式

```bash
npm install          # 首次
cp .env.example .env.local   # 配置 LLM_API_KEY 等（见下）
npm run dev          # 或 npm run build && npm start
```

LLM 配置（OpenAI 兼容端点均可，默认 Moonshot/Kimi）：`LLM_BASE_URL`（默认 https://api.moonshot.cn/v1）、`LLM_API_KEY`、`LLM_MODEL`（默认 kimi-k2-0711-preview）。**未配置时所有 AI 接口返回 503 LLM_NOT_CONFIGURED，前端显示配置指引；无任何假数据**。

## 本 Sprint 交付（git 提交 wave1–wave4）

- 工程：Next.js 16 (App Router) + TS + Tailwind v4 暗色工作台（品牌 LearnLoop）；better-sqlite3 WAL，21 张表 + FTS5(trigram) + 触发器。
- 认证：注册/登录/登出/me，scrypt 哈希，HttpOnly 会话（重启免登），受保护布局重定向。
- 知识库：PDF/DOCX/PPTX 真实上传→后台 jobs 解析（进度轮询）→带页码分块→trigram FTS 检索（文件名+页码+高亮片段+定位）；越权 404；级联删除。
- 课程：目标→LLM 诊断题（3–5 题）→LLM ≥5 单元课纲（zod 契约+失败重试）→可编辑大纲→事务落库；大纲重排保留已完成课时进度；课程列表/详情/删除。
- 课堂：教学状态机 explain→check→remediate/advance→apply→summarize→done；检索→讲解（narration ≤300 字/轮）→检查题→答错换讲法补救+重测；引用由服务端映射真实 chunk（LLM 只回编号，防编造）；自由提问带「资料未覆盖」声明。
- 测评：随堂 quiz 生成（LLM）写 questions；客观题本地批改、简答 LLM 量规评分；attempts 记录难度/提示/错因；掌握度可解释公式（0.6 正确率+0.2 难度加权+0.2 低提示率）。
- 记忆与计划：结课异步生成笔记+3–6 闪卡+复习任务（jobs 幂等）；SM-2 复习调度；/progress 掌握度+错题本；/planner 任务清单；单元完成状态自动汇总。

## 验证结果

- `npm run build` 通过（0 TS 错误），最终路由 30+。
- 端到端 curl 冒烟（本机实测，2026-10-20）：注册×2 → 上传 sample.pdf → ready(3 页 3 块，页码正确) → 检索「反向传播」命中第 2 页 → 越权访问 404 → 建课（5 单元 6 课时+诊断+关联资料）→ 开课 503（无 key，符合防假约定）→ 插入题目走真实批改：答对 mastery 0.88、答错 0.58（与公式手算一致）→ 错题本出现错因标签 → **服务重启后：会话免登、课程/文件/掌握度全部恢复**。
- tsx 单测 scripts/test-wave4.ts：掌握度公式、SM-2、单元汇总全过。
- 测试夹具：scripts/fixtures/generate.mjs 可重新生成中⽂ sample.pdf/docx/pptx。

## 功能覆盖率（P0 范围）

F01 ✅ F02 ✅ F03 ✅（LLM 路径待真实 key 复验）F05 ✅ F06 ✅ F07 ✅ F08 ✅ F09 🚧（生成+复习已通，FSRS 精确算法 P1）F15 🚧（任务清单已通，日历视图 P1）F18 🚧（掌握度+错题已通，画像 P1）F21 ✅ F22 🚧（本地账号已通，计费 P2）。F04/F10–F14/F16–F17/F19–F20/F23–F26 未开始（P1–P3）。

## 已知缺陷与风险

1. **真实 LLM 端到端未验证**（本机无 key）：诊断/课纲/教学回合/quiz/结课产出物的生成质量需配置 key 后人工走查一遍完整闭环。这是当前最高优先事项。
2. trigram FTS 检索词需 ≥3 字符，2 字查询无结果（UI 已标注）。
3. 扫描件 PDF 无 OCR（明确报 failed+中文原因，不静默）。
4. 课堂中栏/右栏输入共享 state，交互可再打磨。
5. 课堂事件为请求-响应模式，未上 SSE/WS（P1 白板同步时引入）。

## 下一阶段（P1 候选，按价值排序）

1. 配置真实 LLM key 走查 P0 全闭环并修 prompt 质量问题。
2. F04 互动白板：Excalidraw + board_actions 协议（schema 已预留 board_actions 表）+ 暂停/回放/打断。
3. F14 Deep Learn 连续单元推进；F10 速查表；F12 Mermaid 知识图。
4. F15 日历视图（FullCalendar Standard）+ F16 主动学习动态。
5. Embedding 混合检索（schema 已预留 embedding 列）。
