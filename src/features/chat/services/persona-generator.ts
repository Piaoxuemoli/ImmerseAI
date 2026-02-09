/**
 * PersonaGenerator Stub
 *
 * 占位实现：返回示例数据，模拟 500ms 延迟。
 * 后续 change 将替换为 RAG + LLM 实际生成逻辑。
 */

interface GeneratedPersonaData {
  description: string
  personality: string
  speechStyle: string
  background: string
  keyQuotes: string[]
}

export async function generatePersonaStub(
  _bookId: string,
  name: string
): Promise<GeneratedPersonaData> {
  // 模拟异步生成延迟
  await new Promise((resolve) => setTimeout(resolve, 500))

  return {
    description: `${name}是书中一位令人印象深刻的角色，拥有独特的人格魅力和丰富的内心世界。`,
    personality: `沉稳内敛，善于思考。在关键时刻展现出果断的一面，同时内心保持着对理想的坚守。`,
    speechStyle: `言简意赅，偏好用隐喻和反问表达观点。语气平静但充满力量，偶尔流露出诗意。`,
    background: `${name}的成长经历塑造了其独特的世界观。经历过重大转折后，对人生有着超越常人的深刻理解。`,
    keyQuotes: [
      `"这是${name}的第一句代表性台词。"`,
      `"这是${name}的第二句代表性台词。"`,
      `"这是${name}的第三句代表性台词。"`,
    ],
  }
}
