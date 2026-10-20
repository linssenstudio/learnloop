# P0 开发任务清单（按 Wave 划分，每 Wave 以 `npm run build` 通过为门禁）

## Wave 1 — 脚手架与核心基建
- [ ] Next.js(App Router)+TS+Tailwind 工程，暗色学习工作台布局
- [ ] `src/lib/db.ts`：better-sqlite3 + 全量 schema 初始化（见 03-data-model.md）
- [ ] `src/lib/auth.ts`：注册/登录/登出/me，scrypt 哈希 + 会话 Cookie，中间件保护路由
- [ ] `src/lib/llm.ts`：OpenAI 兼容网关（chat + JSON 强制输出 + zod 校验 + token 用量记录），未配置返回 `LLM_NOT_CONFIGURED`
- [ ] 页面骨架：/login /register /dashboard（今日任务、最近课程、快速入口）

## Wave 2 — 知识库
- [ ] `POST /api/files` 上传（PDF/DOCX/PPTX，≤30MB）→ jobs 表 → 后台解析
- [ ] 解析器：pdfjs-dist / mammoth / jszip+xml，输出带页码/标题的 chunks，写入 FTS5
- [ ] `GET /api/files`、`GET /api/files/:id`（状态轮询）、`GET /api/files/:id/chunks?query=` 检索
- [ ] /library 页面：上传、解析进度、原文预览、页码跳转、检索

## Wave 3 — 课程向导与课程主页
- [ ] `POST /api/courses/diagnose`：目标→3–5 道诊断题（LLM JSON）
- [ ] `POST /api/courses/plan`：目标+诊断结果+已选资料→≥5 单元课纲（JSON 契约，zod 校验，失败重试 1 次）
- [ ] `POST /api/courses` / `GET /api/courses` / `GET|PATCH /api/courses/:id`（大纲可编辑）
- [ ] /courses/new 三步向导：目标 → 诊断 → 大纲编辑确认；/courses、/courses/[id]（单元树+进度+关联资料）

## Wave 4 — 课堂、测评与记忆
- [ ] `POST /api/lesson-sessions`（开始/恢复）、`POST /api/lesson-sessions/:id/respond`（学生回答/提问）
- [ ] 教学状态机（explain→check→remediate/advance→apply→summarize），每轮小步输出，引用 chunks 页码
- [ ] 随堂测验生成与批改、错因分析（remediation 换类比重讲+重测）
- [ ] `attempts`/`mastery_states` 写入与可解释掌握度规则
- [ ] 结课生成：笔记 + 复习卡 + 下次学习任务（study_tasks）
- [ ] /courses/[id]/learn/[lessonId] 三栏课堂 UI；/progress（掌握度/错题）；/planner（任务清单）

## 集成验证
- [ ] `npm run build` 通过；curl 冒烟：注册→上传→解析→建课→上课→答题→重登恢复
- [ ] Sprint 报告：覆盖率、已知缺陷、下阶段计划（写入 docs/05-sprint-1-report.md）

## LLM JSON 契约（各 Wave 遵守）
- 诊断：`{questions:[{question,options[4],answer,rationale}]}`
- 课纲：`{title,units:[{title,summary,lessons:[{title,objectives[],est_minutes}]}]}`
- 教学回合：`{state,step,narration,board_actions[],check_question|null,citations:[{file_id,page,snippet}],advance:boolean}`
- 测验：`{questions:[{concept,type,difficulty,question,options?,answer,explanation}]}`
- 批改：`{correct,score,error_tag,feedback,remediation|null}`
