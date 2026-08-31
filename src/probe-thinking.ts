process.loadEnvFile(new URL("../.env", import.meta.url).pathname);
const KEY = process.env.DEEPINFRA_API_KEY ?? "";
const MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";

async function probe(label: string, extra: Record<string, unknown>) {
  const r = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: "Is this comment mean-spirited? 'lol imagine being this soft'" }],
      max_tokens: 400,
      ...extra,
    }),
  });
  if (!r.ok) {
    console.log(`[${label}] HTTP ${r.status}: ${(await r.text()).slice(0, 140)}`);
    return;
  }
  const j = (await r.json()) as any;
  const msg = j.choices?.[0]?.message ?? {};
  const content = String(msg.content ?? "");
  console.log(`[${label}] message keys: ${Object.keys(msg).join(", ")}`);
  console.log(`  reasoning_content: ${msg.reasoning_content ? `있음 (${String(msg.reasoning_content).length}자) "${String(msg.reasoning_content).slice(0, 120)}…"` : "없음"}`);
  console.log(`  content starts: "${content.slice(0, 100).replace(/\n/g, "\\n")}"`);
  console.log(`  usage: ${JSON.stringify(j.usage ?? {})}`);
}

async function main() {
  await probe("baseline", {});
  await probe("reasoning_effort=medium", { reasoning_effort: "medium" });
  await probe("chat_template_kwargs.thinking", { chat_template_kwargs: { thinking: true } });
}
main();

probe("reasoning_effort=low + max1400", { reasoning_effort: "low", max_tokens: 1400 });
