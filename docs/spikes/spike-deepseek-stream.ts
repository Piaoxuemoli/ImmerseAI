// docs/spikes/spike-deepseek-stream.ts
// 最小化示例：使用 OpenAI SDK 调用 DeepSeek API 流式输出
// 来源: https://api-docs.deepseek.com/zh-cn/

import OpenAI from "openai";

async function streamChat() {
  const client = new OpenAI({
    apiKey: "sk-your-deepseek-key",
    baseURL: "https://api.deepseek.com",  // DeepSeek 端点
  });

  // 流式调用
  const stream = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: "你现在是章北海，三体中的军人角色。请完全带入角色回答。"
      },
      {
        role: "user",
        content: "你为什么要劫持自然选择号？"
      }
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  });

  // 逐 chunk 接收
  let fullContent = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    fullContent += delta;
    process.stdout.write(delta); // 实时打印
  }

  console.log("\n\n--- Full response ---");
  console.log(fullContent);
}

streamChat().catch(console.error);
