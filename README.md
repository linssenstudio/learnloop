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
git clone <repo-url> && cd learnloop
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

## 设计文档

见 `docs/`：差距分析、ADR-0001 技术栈、数据模型、P0 任务清单。
