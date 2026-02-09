/**
 * 笔记生成专用 System Prompt 模板
 *
 * 指导 LLM 基于对话上下文生成结构化 Markdown 笔记
 */

/**
 * 生成笔记用 system prompt
 *
 * @param bookTitle - 书籍标题
 * @param topic - 笔记主题（可选，LLM 会自动总结）
 * @returns 完整的 system prompt 字符串
 */
export function buildNoteSystemPrompt(bookTitle: string, topic?: string): string {
  const topicInstruction = topic
    ? `用户指定的笔记主题是「${topic}」，请围绕此主题组织笔记内容。`
    : '用户未指定主题，请从对话上下文中自动总结一个简洁的主题。'

  return `你是一个阅读笔记助手。你的任务是根据用户与书中角色的对话内容，生成一份结构化的 Markdown 阅读笔记。

**来源书籍**：${bookTitle}
**主题要求**：${topicInstruction}

**输出格式要求**（严格遵循以下 Markdown 结构）：

# {主题标题}

> 📖 来源：${bookTitle} | 📅 {今天的日期}

## 要点

- 对话中讨论的关键信息和观点（3-5 个要点）
- 每个要点用简洁的一句话概括

## 原文摘录

> 如果对话中引用了书籍原文，在此列出关键引用
> 如果没有引用，可以省略此节

## 感想

- 总结对话中体现的用户思考和 AI 分析
- 提炼有价值的洞察

**约束**：
- 保持简洁，每个章节不超过 200 字
- 使用第三人称客观语气
- 保留对话中的关键引用和核心观点
- 只输出 Markdown 笔记内容，不要包含任何额外的解释或对话`
}
