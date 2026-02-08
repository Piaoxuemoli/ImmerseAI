## 1. 项目依赖安装

- [x] 1.1 安装 zustand 依赖：`npm install zustand@^4.5.0`
- [x] 1.2 验证 package.json 中 zustand 版本正确

## 2. TypeScript 接口定义

- [x] 2.1 在 src/shared/types/index.ts 中定义 ImmerseStore 接口
- [x] 2.2 从 @/shared/types 导入所有必需的领域类型（Book, Persona, ChatSession, Message）
- [x] 2.3 定义书架状态字段：books, selectedBookId, connectionStatus
- [x] 2.4 定义阅读器状态字段：currentCfi, readerMode
- [x] 2.5 定义角色状态字段：personas, activePersonaId
- [x] 2.6 定义对话状态字段：currentSession, isGenerating
- [x] 2.7 定义 RAG 状态字段：indexingProgress
- [x] 2.8 定义所有基础 actions 类型签名：setBooks, selectBook, addMessage, setPersona, toggleMode
- [x] 2.9 确保所有字段类型明确，禁止使用 any 或 unknown

## 3. Store 文件结构创建

- [x] 3.1 创建 src/shared/store 目录
- [x] 3.2 创建 src/shared/store/index.ts 文件
- [x] 3.3 在 store/index.ts 中添加文件头注释（说明 Store 用途和持久化策略）

## 4. Zustand Store 基础实现

- [x] 4.1 从 zustand 导入 create 函数
- [x] 4.2 从 zustand/middleware 导入 persist 中间件
- [x] 4.3 从 @/shared/types 导入 ImmerseStore 接口和领域类型
- [x] 4.4 使用 create<ImmerseStore>() 创建 store
- [x] 4.5 定义所有初始状态值（books=[], selectedBookId=null 等）

## 5. 持久化配置

- [x] 5.1 配置 persist 中间件包裹 store 定义
- [x] 5.2 设置 storage key 为 'immerse-store'
- [x] 5.3 实现 partialize 函数，仅返回 books, personas, currentSession 三个字段
- [x] 5.4 验证 partialize 函数排除了 indexingProgress, isGenerating, connectionStatus
- [x] 5.5 确保 persist 配置正确（name, partialize 参数完整）

## 6. 书架 Actions 实现

- [x] 6.1 实现 setBooks action：接收 Book[] 参数，更新 books 状态
- [x] 6.2 实现 selectBook action：接收 bookId 参数，更新 selectedBookId
- [x] 6.3 实现 setConnectionStatus action：更新 connectionStatus 字段
- [x] 6.4 验证所有 action 返回类型为 void

## 7. 阅读器 Actions 实现

- [x] 7.1 实现 setCurrentCfi action：接收 cfi 参数，更新 currentCfi
- [x] 7.2 实现 toggleMode action：在 'read' 和 'chat' 之间切换 readerMode
- [x] 7.3 实现 setReaderMode action：直接设置 readerMode 值

## 8. 角色 Actions 实现

- [x] 8.1 实现 setPersonas action：接收 Persona[] 参数，更新 personas
- [x] 8.2 实现 setPersona action：接收单个 Persona，添加或更新到 personas 数组
- [x] 8.3 实现 setActivePersona action：接收 personaId，更新 activePersonaId
- [x] 8.4 实现 removePersona action：接收 personaId，从 personas 数组删除

## 9. 对话 Actions 实现

- [x] 9.1 实现 setCurrentSession action：接收 ChatSession | null，更新 currentSession
- [x] 9.2 实现 addMessage action：接收 Message，添加到 currentSession.messages 数组
- [x] 9.3 实现 setIsGenerating action：接收 boolean，更新 isGenerating
- [x] 9.4 确保 addMessage 正确处理 currentSession 为 null 的情况

## 10. RAG Actions 实现

- [x] 10.1 实现 setIndexingProgress action：接收 bookId 和 progress (0-100)，更新 indexingProgress
- [x] 10.2 实现 clearIndexingProgress action：接收 bookId，清除该书的进度
- [x] 10.3 验证 indexingProgress 的 Record<string, number> 类型正确

## 11. Store 导出配置

- [x] 11.1 导出 useStore hook：`export const useStore`
- [x] 11.2 可选：re-export ImmerseStore 类型：`export type { ImmerseStore }`
- [x] 11.3 验证导出的 useStore 类型为 UseBoundStore<StoreApi<ImmerseStore>>

## 12. TypeScript 类型验证

- [x] 12.1 运行 `npx tsc --noEmit` 确保 0 编译错误
- [x] 12.2 检查 IDE 中 useStore 的类型提示是否完整
- [x] 12.3 验证所有 action 参数都有正确的类型推导
- [x] 12.4 确保没有使用 any 或 unknown 类型

## 13. 持久化功能测试

- [x] 13.1 在临时测试组件中调用 setBooks 添加测试数据
- [x] 13.2 刷新页面，验证 books 数据从 localStorage 恢复
- [x] 13.3 验证 indexingProgress 在刷新后重置为 {}
- [x] 13.4 验证 isGenerating 在刷新后重置为 false
- [x] 13.5 在浏览器 DevTools > Application > Local Storage 中查看 'immerse-store' key
- [x] 13.6 验证存储的数据仅包含 books, personas, currentSession

## 14. Selector 性能验证

- [x] 14.1 创建测试组件，使用单字段 selector：`useStore(state => state.books)`
- [x] 14.2 更新其他字段（如 isGenerating），验证测试组件不 re-render
- [x] 14.3 更新 books 字段，验证测试组件正确 re-render
- [x] 14.4 测试多字段订阅使用 shallow 比较的场景

## 15. 文档和代码清理

- [x] 15.1 在 store/index.ts 顶部添加文件注释（说明持久化策略和用法示例）
- [x] 15.2 为复杂的 action 添加 JSDoc 注释
- [x] 15.3 确保代码风格一致（4 空格缩进，分号使用等）
- [x] 15.4 移除所有 console.log 调试代码（如有）

## 16. 最终验证

- [x] 16.1 运行 `npm run dev` 确保开发服务器正常启动
- [x] 16.2 运行 `npm run build` 确保生产构建成功
- [x] 16.3 验证 dist 目录中包含 store 相关代码
- [x] 16.4 检查构建产物大小，确认 zustand 体积符合预期（~1KB）
