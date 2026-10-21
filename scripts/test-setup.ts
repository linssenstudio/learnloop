// 验证：llm.ts 运行时动态读 env；writeEnvLocal 保留其它行并同步 process.env
// 用法：mkdir -p /tmp/envtest && cd /tmp/envtest && npx --prefix /Users/hr04/Desktop/HYPERKNOW tsx /Users/hr04/Desktop/HYPERKNOW/scripts/test-setup.ts
import fs from "node:fs";
import { llmConfig, LlmNotConfiguredError } from "../src/lib/llm";
import { writeEnvLocal, setupStatus } from "../src/lib/setup";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("PASS:", msg);
}

async function main() {
delete process.env.LLM_API_KEY;
delete process.env.LLM_MODEL;
assert(llmConfig().model === "kimi-k2-0711-preview", "缺省模型为 kimi-k2-0711-preview");
process.env.LLM_MODEL = "runtime-model-x";
assert(llmConfig().model === "runtime-model-x", "运行时修改 LLM_MODEL 立即生效（无缓存）");
assert(setupStatus().configured === false && setupStatus().keyHint === null, "未配置时 keyHint 为 null");

process.env.LLM_API_KEY = "sk-abcd1234efgh";
const st = setupStatus();
assert(st.configured === true && st.keyHint === "sk-a***", `keyHint 只暴露前4位: ${st.keyHint}`);

const chatJsonModule = await import("../src/lib/llm");
delete process.env.LLM_API_KEY;
try {
  await chatJsonModule.chatText({ system: "s", user: "u" });
  assert(false, "未配置时应抛错");
} catch (e) {
  assert(e instanceof LlmNotConfiguredError, "删除 env 后立即恢复 LlmNotConfiguredError（动态读取）");
}

fs.writeFileSync(".env.local", "OTHER_KEY=keep-me\nLLM_API_KEY=old-key\n# 注释行\nLLM_BASE_URL=https://old.example/v1\n");
writeEnvLocal({ baseUrl: "https://api.moonshot.ai/v1", apiKey: "sk-newkey9999", model: "kimi-latest" });
const content = fs.readFileSync(".env.local", "utf8");
assert(content.includes("OTHER_KEY=keep-me"), "保留其它行");
assert(content.includes("# 注释行"), "保留注释行");
assert(content.includes("LLM_API_KEY=sk-newkey9999") && !content.includes("old-key"), "LLM_API_KEY 被更新而非追加");
assert(content.includes("LLM_BASE_URL=https://api.moonshot.ai/v1") && content.includes("LLM_MODEL=kimi-latest"), "三行齐全");
assert(process.env.LLM_API_KEY === "sk-newkey9999" && process.env.LLM_MODEL === "kimi-latest", "process.env 同步更新（无需重启）");

console.log("\n全部通过");
}

main();
