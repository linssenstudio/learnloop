# LearnLoop

原创品牌 AI 学习工作台：上传资料建成知识库，AI 为你诊断基础、规划课程大纲，并以小步教学法带你上课——讲解、提问、补救、测验、结课产出笔记与闪卡，配合掌握度跟踪与间隔重复复习，形成完整的学习闭环。

## 技术栈

- Next.js（App Router）+ TypeScript + Tailwind CSS v4，前后端同进程
- SQLite（better-sqlite3，WAL 模式）+ FTS5 全文检索（trigram 分词，中文友好）
- LLM 网关：任意 OpenAI 兼容端点（默认 Moonshot/Kimi）
- 本地文件存储（`data/uploads/`），零外部服务依赖（除 LLM API）

## 快速开始

环境要求：Node.js ≥ 20（推荐 22+）。

### 方式一：接入向导（推荐）

```bash
git clone https://github.com/linssenstudio/learnloop.git && cd learnloop
npm install
npm run dev
```

打开 http://localhost:3000 ，会自动进入 **API 接入向导**：选择服务商预设（Moonshot 国内/国际）或自定义端点 → 粘贴 API Key → 测试连接 → 选择模型 → 保存并开始。全程约 30 秒，无需重启。

还没有 Key？可去 [platform.moonshot.cn](https://platform.moonshot.cn) 免费获取。

### 方式二：手动配置（服务器/无头部署）

在项目根目录创建 `.env.local`：

```bash
LLM_BASE_URL=https://api.moonshot.cn/v1
LLM_API_KEY=sk-your-key-here
LLM_MODEL=kimi-k2-0711-preview
```

参考 `.env.example`。之后 `npm run dev` 即可。向导保存与手动编辑完全等价，随时可互相覆盖。

> `.env.local` 与 `data/`（数据库、上传文件）均已加入 `.gitignore`，不会被提交。

## 功能地图

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| 接入向导 | /setup | 首次启动自动进入，已配置后需登录修改 |
| 工作台 | /dashboard | 最近课程、今日待办、连续学习天数 |
| 知识库 | /library | PDF/DOCX/PPTX 上传解析、全文检索、按页引用 |
| 课程 | /courses | 三步向导（目标→诊断→大纲）、课程主页、大纲编辑 |
| 课堂 | /courses/[id]/learn/[lessonId] | 小步教学状态机、随堂测验、引用面板 |
| 学习计划 | /planner | 结课自动生成复习任务 |
| 我的成长 | /progress | 概念掌握度、错题本 |
| 闪卡 | /courses/[id]/flashcards | SM-2 间隔重复 |
| 设置 | /settings | 模型接入查看与重新配置 |

## 常用命令

```bash
npm run dev     # 开发
npm run build   # 生产构建
npm start       # 生产运行
node scripts/fixtures/generate.mjs   # 生成测试用 PDF/DOCX/PPTX
npx tsx scripts/test-wave4.ts        # 非 LLM 链路单测（掌握度/SM-2/单元汇总）
```

## 项目状态与路线图

**当前：P0 已完成**——注册登录、资料上传解析与引用检索、课程诊断与大纲生成、AI 小步教学（讲解/提问/答错补救）、随堂测验批改、掌握度与错题本、闪卡间隔复习、学习计划、数据持久化（重启完整恢复）。功能覆盖明细与验收结果见 `docs/05-sprint-1-report.md`。

- **P1（进行中/下一步）**：互动白板（Excalidraw + 结构化板书协议）、Deep Learn 连续单元学习、速查表、知识图谱、日历视图、学习者画像
- **P2**：AI 讲解视频、深度研究、多格式导出、教师风格自定义、模型路由与用量管理
- **P3**：LMS 集成（授权后）、课程广场、实时语音、班级/教师后台

> 合规说明：本项目参考 Hyperknow 的**公开功能**进行原创实现，不使用其商标、素材与私有代码。所有 AI 生成内容均来自你自己配置的模型与你上传的资料。

## 设计文档

见 `docs/`：
- `01-gap-analysis.md` — 功能差距表（F01–F26 对标清单）
- `02-adr-0001-stack.md` — 技术栈决策记录
- `03-data-model.md` — 数据库设计（21 张表，含掌握度规则）
- `04-task-list.md` — P0 任务清单与 LLM JSON 契约
- `05-sprint-1-report.md` — Sprint 1 验证结果、已知缺陷、P1 计划

## License

[MIT](LICENSE)
