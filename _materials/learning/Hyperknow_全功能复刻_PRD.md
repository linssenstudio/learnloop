# Hyperknow 类 AI 智能学习平台 — 全功能建设方案（PRD v0.1）

> 目标：合法地复现 Hyperknow 已公开的核心**功能与学习体验**，形成原创品牌、原创代码、可持续迭代的 AI 学习工作台。
> 日期：2026-10-19。依据官方公开网页与独立评测；未登录付费账户实测。本文的“复刻”是同等能力的独立实现，不包含复制对方的商标、素材、私有代码或绕过访问限制。

## 0. 产品定位

- 用户群：先满足自学者与教师/教研人员，后扩展团队/机构与学习社区。
- 产品价值：从「提出学习目标」到「学会并能迁移应用」的完整闭环，而非单次 AI 问答。
- 核心闭环：学习目标 → 资料摄取 → 学习诊断 → 自动课程规划 → AI 教师互动授课 → 实操/测验 → 批改/错因诊断 → 巩固复习 → 学习记忆更新 → 主动安排下一次学习。
- 设计原则：学习者必须动手输出，AI 不只是交付答案；所有事实尽可能给出来源；对资料不足明确提示。

## 1. 功能清单与证据级别

证据级别：A=Hyperknow 官方页面明确描述；B=2026 年公开第三方评测/演示；C=我方建议新增的增强能力。`A/B` 并不表示完成登录态逐屏验收。

| 编号 | 功能 | 用户可见行为 | 来源/级别 | 建设优先级 |
|---|---|---|---|---|
| F01 | 学习目标入口 | 用户描述想学什么、基础、时长与产出目标 | A/B | P0 |
| F02 | 自动课程生成 | 自动生成单元、课时、目标、先修关系、练习、项目 | B | P0 |
| F03 | AI 教师深度教学 | 分步骤、对话式、循序渐进、因答题反馈调整深度 | A/B | P0 |
| F04 | 互动白板 | 逐步生成文字、公式、图形/流程，支持暂停、回放、打断提问 | B | P1 |
| F05 | 知识库/资料上传 | PDF、DOCX、PPTX、图片；解析与全文检索 | A | P0 |
| F06 | 长文档理解 | 大书分章提取、提炼概念并定位来源页码 | A | P0 |
| F07 | 基于资料问答 | 优先基于课件/书籍检索回答，回溯原始段落 | A | P0 |
| F08 | AI 考题/测验 | 单选、多选、简答、应用题；即时反馈与讲评 | A | P0 |
| F09 | 记忆卡 | 从内容生成 flashcards、复习队列 | A | P1 |
| F10 | 总结与知识速查表 | 生成结构化重点，调节列数、字号、高亮、打印导出 | A | P1 |
| F11 | 题目分步解答 | 支持图片/文字解题，优先提示与引导而非直接给答案 | B | P1 |
| F12 | 知识可视化 | 图表、关系图、流程图、公式动画 | A/B | P1 |
| F13 | 教学短视频 | 大纲→脚本→配音→视觉动画→渲染 MP4 | A/B | P2 |
| F14 | Deep Learn Sessions | 以单元推进的教师主导式学习，节奏适配 | A/B | P1 |
| F15 | 学习计划/日历 | 根据目标、期限、学习时间生成并调整计划 | A | P1 |
| F16 | 主动学习动态 | 自动提醒待学、薄弱点、重点复习内容 | A/B | P1 |
| F17 | Canvas LMS 等课程系统 | 在得到授权后读取作业/截止时间等用于排程 | A/B | P3 |
| F18 | Learner Persona | 基于表现、偏好、知识状态建立长期学习档案 | A/B | P1 |
| F19 | 研究与多来源验证 | Web 深度检索、参考资料摘要、准确引用 | B | P2 |
| F20 | 课程广场 | 浏览/复制/分享预设课程与学习路径 | B | P3 |
| F21 | 历史会话/工作台 | 学习进度、课程列表、笔记和附件可回溯 | B | P0 |
| F22 | 个人账号、权限、计费 | 注册、登录、多用户隔离、额度与订阅 | A（套餐）/C（设计） | P2 |
| F23 | 语音实时教师 | 语音讲授、语音打断、口头回答 | C | P3 |
| F24 | 教师自定义教学风格 | 苏格拉底式/讲授式/项目式，可导入自己的 Skill | C | P2 |
| F25 | 课件/笔记/测验导出 | PDF、Markdown、CSV、分享链接 | A（速查表）/C（扩展） | P2 |
| F26 | 教师后台/班级 | 建课、分发、学生进度与汇总分析 | C | P3 |

**不能仅凭公开资料声称已精准复刻的部分**：登录后导航结构、各模式下的细微交互、实际白板动作协议、收费额度、课程市场细节、内部记忆存储/算法、Canvas 集成范围。必须通过合法试用账号、屏幕录制和验收表逐项补齐。

## 2. 产品信息架构（桌面优先，兼容移动端）

```text
AI 智能学习工作台
├─ 首页 Dashboard
│  ├─ 今天学什么 / 主动提醒 / 最近课程 / 学习连续天数
│  └─ 快速入口：学新东西 / 讲解难点 / 生成资料 / 解题
├─ 我的课程 Courses
│  ├─ 创建课程：目标 → 学习者诊断 → 大纲编辑 → 确认
│  ├─ 课程主页：单元目录、任务、进度、学习成果
│  └─ 课堂 Learning Session
│      ├─ 左：课程章节树 / 关键概念
│      ├─ 中：动态互动白板 / 课件 / 视频
│      ├─ 右：AI 教师对话与课堂问答
│      └─ 下：上一步、下一步、暂停、提问、笔记、练习
├─ 知识库 Library
│  ├─ 文件、文件夹、标签、版本、解析状态
│  └─ 原文预览、引用跳页、检索与交叉比对
├─ 学习工具 Studio
│  ├─ 考题与模拟考试 / Flashcards
│  ├─ Cheatsheets 与总结 / 图示与知识地图
│  └─ 教学视频 / 问题求解 / 研究模式
├─ 学习计划 Planner
│  ├─ 日历、每日任务、提醒、重新排程
│  └─ 截止日期及外部课程系统（未来可选）
├─ 我的成长 Progress
│  ├─ 掌握度、错题、知识盲区、复习记录
│  └─ 学习者画像与记忆管理
└─ 设置 Settings
   ├─ 模型供应商/API、教师风格、隐私
   ├─ 账号/团队/资源用量
   └─ 课程与资料导出/删除
```

## 3. 核心用户流程

### 流程 A：零基础学一个新主题

1. 输入「我要从零学会 AI Agent，最终能给员工做培训」及时间、基础、产出目标。
2. 导师做 3–5 个诊断问题；若不愿回答，采用显式默认初学者假设。
3. 教研 Agent 给出课纲：单元、课次、知识依赖、练习、实操作业、验收标准与预计学时。
4. 学生能修改课纲并确认，系统持久化 `Course`、`Lesson`、`Objective`。
5. 课堂以结构化白板步骤呈现，导师在每个知识节点询问或发起微型练习。
6. 学生答错时分析错因，切换更基础类比/补充前置知识，**不跳过关键考核**。
7. 结束生成笔记、测验、卡片与下次学习任务；学习状态可跨会话恢复。

### 流程 B：上传一本书并学习

1. 上传 PDF/DOCX/PPTX、音频或课程录音（需按文件类型限制）；显示解析进度。
2. 保存文件存储引用与结构化章节、页码/时间戳、分块信息、向量索引。
3. AI 先生成「书的知识结构 + 来源地图」，将难度/版本/空缺标记出来。
4. 选择「逐章授课」「课程改编」「知识地图」「速查表」「生成题库」。
5. 教学与问答必须包含可点开的来源引用；原文查不到则明确说明。

### 流程 C：每天自动学下一课

1. 计划系统读取课程目标、剩余时间、掌握度、学习偏好、可用时间。
2. 每次重新计算任务优先级，不删除失败记录，不默默修改用户手动固定的日期。
3. 生成今日推荐：新知识、练习、间隔复习、补齐薄弱点。
4. 学习结果更新 mastery state，错题按知识点映射，后续推荐随之变化。

## 4. AI 教师的底层状态机

核心不是单条长提示词，而是显式状态机。建议：

`DIAGNOSE -> PLAN -> EXPLAIN -> DEMONSTRATE -> CHECK -> [REMEDIATE | ADVANCE] -> APPLY -> SUMMARIZE -> SCHEDULE`

- **DIAGNOSE**：用户目标 + 诊断题 + 已有历史，构建起始能力地图。
- **PLAN**：先修关系排序，细化到每节课目标和通过条件。
- **EXPLAIN**：从用户掌握的概念开始，讲一小段。
- **DEMONSTRATE**：渲染白板内容、例题和图示。
- **CHECK**：要求学生回答可自动判定的具体问题。
- **REMEDIATE**：错了要识别错因、换说法、增加脚手架、重测。
- **ADVANCE**：达到章节掌握阈值才进入下一知识点（阈值可配置）。
- **APPLY**：出一道变式题或微项目验证知识迁移。
- **SUMMARIZE**：生成笔记、错因、卡片与下一个行动。
- **SCHEDULE**：写入学习计划与复习队列。

掌握度不能仅靠「AI 感觉学生会了」。至少保存答题正确性、完成时间、题目难度、重试次数、提示次数、评估依据，并用可解释规则计算初版掌握度。开放式题目的 AI 评分应保留评分量规和理由。

## 5. 多 Agent 协作架构

- Orchestrator（主调度）：理解用户意图，选择低成本工具/工作流，管理状态和失败重试。
- Source Agent（资料专家）：解析、检索、重排序、引证、来源冲突检测。
- Curriculum Agent（教研）：目标拆解、知识先修图、课纲与活动编排。
- Tutor Agent（授课）：课堂对白、循序讲解、白板动作、提问控制。
- Assessment Agent（评估）：题库、答卷评分、错因分析、掌握度。
- Artifact Agent（内容工厂）：速查表、卡片、图示、视频与可下载材料。
- Planner Agent（规划）：课程进度、截止日期、间隔重复与提醒。
- Learner Memory（学习画像服务）：结构化学习事实、信心水平、更新记录、删除能力。
- Reviewer（质量审查）：引用可用性、数学/代码正确性、题目与标准答案一致性。

原则：不是每轮都并发 8 个 Agent。一般走**单主控 + 按需工具化子工作流**，由类型化输入输出约束，减少延迟和费用。

## 6. 互动白板：复刻教学体验最重要的难点

不要让语言模型直接执行任意前端 JS。AI 只输出经 JSON Schema 校验的白板动作：

```json
{
  "lesson_id": "lesson-001",
  "step": 3,
  "narration": "现在来看为什么检索会改变 AI 的答案。",
  "board_actions": [
    {"type": "add_text", "id": "t1", "text": "RAG = 检索 + 生成", "x": 80, "y": 65},
    {"type": "add_box", "id": "b1", "text": "资料库", "x": 80, "y": 160},
    {"type": "add_arrow", "from": "b1", "to": "t1"}
  ],
  "check_question": {"type": "short_answer", "question": "为什么不直接依赖模型原有知识？"},
  "source_refs": []
}
```

- 白板客户端可以使用 `tldraw` 或 `Excalidraw` 风格的原创组件，支持数学 KaTeX、Mermaid/SVG 图示、时间轴、代码段。
- 每个 `board_action` 为幂等、有序、可撤销动作，支持暂停/重放和教师临时插入补充步骤。
- 用户问「这一步没懂」，课时状态暂停并生成解释步骤，完成后恢复主线。
- 课堂语音为增强版，先实现文字同步，再接 TTS；不要把语音作为基础课程的硬依赖。

## 7. 推荐技术架构

**前端**：Next.js + TypeScript + Tailwind CSS + shadcn/ui；tldraw（注意其许可与当前版本条款）/自研 SVG 画布；TipTap 笔记编辑器；KaTeX；PDF.js。

**后端**：FastAPI（Python，适合文档、Agent 与视频工作流）+ Pydantic 严格 schema；认证可用 Supabase Auth；若纯 TS 也可使用 Next.js Route Handlers 配合 Python worker。

**数据库**：PostgreSQL + pgvector（文档检索）；Redis（队列/临时态）；对象存储（S3 兼容）放源文件/导出/视频。

**异步**：Celery/RQ + Redis 或 Inngest/Trigger.dev；长任务必须有进度、取消、幂等重试与失败追踪。

**大模型**：Provider Adapter 将 Gemini/OpenAI/其他模型统一接口封装；按工作流路由，使用 Structured Outputs 约束 JSON。**不要硬编码特定供应商或在前端暴露密钥**。

**解析/检索**：PyMuPDF、python-docx、python-pptx、音频 ASR；保留页码、文件版本、段落定位；embedding + 混合搜索 + reranker；严格来源映射。

**视频**：先 HTML/SVG/Remotion 模板讲解视频，再可选 Manim 动画；配音用合法 TTS 服务；FFmpeg 合成，队列异步运行，处理失败可重试。

**发布**：前端 Vercel/Netlify；API 与视频 worker 分别部署可执行 Python 容器的平台；托管数据库、对象存储与日志。

## 8. 最小数据库实体

`User`, `Workspace`, `Course`, `CourseUnit`, `Lesson`, `LearningObjective`, `KnowledgeNode`, `PrerequisiteEdge`, `SourceFile`, `SourceChunk`, `Citation`, `TeachingSession`, `BoardAction`, `TutorMessage`, `Assessment`, `Question`, `Attempt`, `Rubric`, `MasteryState`, `Flashcard`, `ReviewEvent`, `StudyTask`, `Reminder`, `LearnerProfile`, `MemoryEvent`, `Artifact`, `GenerationJob`, `IntegrationConnection`, `UsageRecord`。

所有用户数据带 owner/workspace 范围；知识 chunk 必须指向原始文件与页码/时间戳；生成内容必须可追溯并能删除。

## 9. 核心 API 草案

- `POST /api/courses/plan` 依据 goal + 资料规划课纲。
- `POST /api/courses` / `GET /api/courses/:id` 保存与获取课程。
- `POST /api/files` 预签名上传，`GET /api/jobs/:id` 查询解析进度。
- `POST /api/lesson-sessions` 开始/恢复课堂。
- `POST /api/lesson-sessions/:id/respond` 回答互动题/向老师提问。
- `GET /api/lesson-sessions/:id/events` SSE 推送板书与教师解释事件。
- `POST /api/assessments/generate` / `POST /api/attempts` 题目与答卷。
- `POST /api/artifacts/generate` 生成笔记/速查表/卡片/视频，返回 job id。
- `GET /api/progress` / `GET /api/planner` 学习进度与日历。
- `POST /api/planner/replan` 基于用户可用时间与掌握度重排。
- `GET/DELETE /api/memory` 记忆可查看、纠正、移除。

## 10. 交付阶段与验收标准

### P0 — 能独立用起来的 AI 学习工作台

- 可创建并持久化课程；PDF/Word/PPT 上传与原文引用；交互式多轮教师；自动练习、批改、进度持久化。
- 不允许只是静态 UI、假按钮或浏览器刷新即丢失的临时状态。
- 最小验收：上传真实课程资料 → 自动生成 5 单元课纲 → 学第 1 节 → 回答 3 题 → 获得错因反馈 → 退出重新登录后准确恢复。

### P1 — 达到 Hyperknow 的教学辨识度

- 互动白板、Deep Learn Session、速查表、记忆卡、知识地图、个人画像、错题复习、主动计划与学习动态。
- 验收：错误回答能触发可观察的补救教学；白板暂停/回放可用；学习任务自动根据进度更新。

### P2 — 内容工厂 + 产品化

- 教学视频、深度研究、多格式导出、教师风格、模型路由、配额/计费、多租户安全与后台。
- 验收：2 分钟课程讲解视频任务可异步完成且源文档映射有效；失败能重试；安全审计通过。

### P3 — 完整平台外围生态

- Canvas LMS 连接（授权与范围审查）、课程广场、班级/教师端、语音实时教学、社区或共享功能。
- 验收：第三方凭据安全、权限控制完整；跨用户数据隔离；用户可撤销连接。

**交付节奏（仅作资源规划，不是工期承诺）**：1–2 名熟练工程师 + 编程 Agent，基础 P0 约数周；完成 P0–P2 并经过稳定性测试一般需数月。高级白板、视频、LMS 与多用户安全会显著改变工期/成本。

## 11. 质量和安全验收

- 答案必须优先依据上传文档；引用能够定位到真正的页码/段落。
- 防止提示词注入：上传的文件、网页内容不能改写系统规则或窃取用户信息。
- 文档/文件访问进行用户级授权检查；不得跨课程泄漏；支持导出和清除数据。
- 限制模型花费、上传体积、生成视频长度；失败返回可操作错误。
- 每条考试题必须有答案、解释、涉及知识点；错误答案、模糊题要进入质检流程。
- 跟踪学习成效：完成率、掌握度提升、错误题再测通过率，而不只追踪生成材料数量。
- 遵循版权与第三方 API 服务条款；不要照搬 Hyperknow 的品牌名、素材、原站图标和内部实现。

## 12. 合法逐功能验收 / 竞品观察模板

| 检查项 | 操作路径/录像时间 | 期望动作 | 我方当前状态 | 差距与修复 |
|---|---|---|---|---|
| 注册/首页 | 待补 | 登录与 dashboard | 未测试 | 待补 |
| 新建课程 | 待补 | 输入目标→课程大纲 | 未测试 | 待补 |
| AI 白板教学 | 待补 | 拆步骤/问答/打断 | 未测试 | 待补 |
| Deep Learn | 待补 | 引导式单元学习 | 未测试 | 待补 |
| 文件上传 | 待补 | 多格式与页码追溯 | 未测试 | 待补 |
| Flashcards/测验 | 待补 | 生成与学习 | 未测试 | 待补 |
| Cheatsheets | 待补 | 编辑/排版/导出 | 未测试 | 待补 |
| 短视频 | 待补 | 视频任务与播放 | 未测试 | 待补 |
| 计划与提醒 | 待补 | 日历/重排 | 未测试 | 待补 |
| 学习者画像 | 待补 | 记忆积累与控制 | 未测试 | 待补 |

## 13. 调研依据（公开来源）

1. Hyperknow 官网：<https://www.hyperknow.io/>
2. Hyperknow 官方 manifesto：<https://www.hyperknow.io/zh-cn/manifesto>
3. Hyperknow 官方 Study with AI：<https://www.hyperknow.io/zh-cn/blogs/study-with-ai>
4. Hyperknow 官方 Cheatsheet 功能说明：<https://www.hyperknow.io/zh-cn/blogs/ai-cheatsheet-generator>
5. Hyperknow 官方视频功能说明：<https://www.hyperknow.io/zh-cn/blogs/get-explainer-video>
6. Hyperknow 官方 Quizlet 替代说明：<https://www.hyperknow.io/zh-cn/blogs/quizlet-alternative>
7. The GenAI Magazine，2026-10-05，AI Professor 与互动白板/课程广场：<https://thegenaimagazine.com/hyperknow-ai-professor-funding-review>
8. 体验评测（2026-03-04，可能为旧版本）：<https://dev.to/aniruddhaadak/i-gave-an-ai-my-study-materials-and-it-planned-my-entire-learning-schedule-hyperknow-is-not-just-53g>

> 公开网页存在产品版本差异，2026 年 10 月新发布的课程与白板产品和此前 Orbie/Deep Learn 工作台并非完全相同；实现时按「旧工作台能力 + 新课程白板能力」合并定义，不能假设每个功能都在当前版本的同一个菜单中。
