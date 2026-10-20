# 数据库设计 v1（SQLite 实现，命名对齐 PRD 实体，可迁移 PostgreSQL）

所有业务表含 `user_id`（租户隔离），`id` 为 `TEXT`（cuid/uuid），时间戳为 `INTEGER`(epoch ms) 或 ISO 文本，统一 `created_at`/`updated_at`。

## 账号
- `users(id, email UNIQUE, password_hash, name, created_at)`
- `sessions(id, user_id → users, token UNIQUE, expires_at, created_at)`

## 知识库
- `source_files(id, user_id, name, mime, size, storage_path, status[parsing|ready|failed], error, page_count, created_at)`
- `source_chunks(id, user_id, file_id → source_files, ord, page INTEGER NULL, heading TEXT NULL, text, embedding BLOB NULL)` —— page 用于引用定位；FTS5 虚拟表 `chunk_fts(text, content='source_chunks')` 同步维护。

## 课程
- `courses(id, user_id, title, goal_text, level, duration_text, outcome, status[planning|active|archived], created_at)`
- `course_units(id, course_id, ord, title, summary, status[pending|active|done])`
- `lessons(id, course_id, unit_id, ord, title, objectives JSON, est_minutes, status[pending|active|done])`
- `course_sources(course_id, source_file_id)` —— 课程与资料关联
- `course_diagnostics(id, course_id, question, options JSON, answer, user_answer, correct INTEGER NULL, ord)`

## 课堂（教学状态机）
- `teaching_sessions(id, user_id, course_id, lesson_id, state[explain|check|remediate|advance|apply|summarize|done], step, created_at)`
- `tutor_messages(id, session_id, role[tutor|student|system], kind[narration|question|answer|feedback|remediation|note], content, citations JSON, step, created_at)`
- `board_actions(id, session_id, step, payload JSON, created_at)` —— P0 仅预留，P1 白板使用

## 测评与掌握度
- `questions(id, course_id, lesson_id NULL, concept, type[single|multi|short], difficulty[1-5], question, options JSON, answer, explanation)`
- `attempts(id, user_id, question_id, session_id NULL, answer, correct INTEGER, score REAL, error_tag TEXT NULL, hints_used INTEGER, duration_ms, created_at)`
- `mastery_states(user_id, course_id, concept, score REAL, attempts INTEGER, correct INTEGER, last_at, PRIMARY KEY(user_id, course_id, concept))`

## 学习产出与计划
- `notes(id, user_id, course_id, lesson_id NULL, title, content_md, created_at)`
- `flashcards(id, user_id, course_id, lesson_id NULL, front, back, source_ref TEXT NULL, ease REAL DEFAULT 2.5, interval_days REAL DEFAULT 0, due_at, reps INTEGER DEFAULT 0, created_at)`
- `review_events(id, user_id, flashcard_id, grade INTEGER, at)`
- `study_tasks(id, user_id, course_id NULL, title, kind[new|review|practice], due_date, status[pending|done|skipped], created_at)`

## 任务与用量
- `jobs(id, user_id, kind[parse_file|plan_course|generate_quiz|generate_artifact], ref_id, status[queued|running|done|failed], progress INTEGER, error, created_at, updated_at)`
- `usage_records(id, user_id, kind, model, prompt_tokens, completion_tokens, created_at)`

## 索引与规则
- 所有外键查询字段建索引；`source_chunks(file_id, ord)` 唯一。
- 掌握度更新规则（可解释）：`score = 0.6*近期正确率 + 0.2*难度加权 + 0.2*(1 - 提示率)`，初始 0；连续独立答对 ≥2 题且 score≥0.8 视为掌握。
- 删除文件级联删 chunks；删除课程级联删 units/lessons/sessions/questions 等。
