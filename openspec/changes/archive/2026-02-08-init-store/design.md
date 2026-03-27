## Context

应用当前缺少统一的全局状态管理系统，导致 Bookshelf、Reader、Chat、Persona 等功能模块的状态分散在各自的组件层级中，无法有效共享和同步。用户的书籍列表、阅读进度、对话历史、角色配置等关键数据在刷新后会丢失。

**当前状态**:
- 无全局状态管理
- 无数据持久化机制
- 组件间通过 props drilling 传递状态（未来会难以维护）

**约束**:
- 必须遵循宪法第二章 2.1 节技术栈：Zustand v4+ 作为全局状态管理
- 必须实现宪法第五章 5.2 节定义的 `ImmerseStore` 接口
- TypeScript strict mode，禁止使用 `any`

**利益相关者**:
- 所有需要访问全局状态的 React 组件
- 用户体验（持久化保证数据不丢失）

## Goals / Non-Goals

**Goals:**
- 建立全局 Zustand store，实现 ImmerseStore 接口
- 实现选择性持久化：关键业务数据（books, personas, currentSession）→ localStorage
- 提供类型安全的 state 读取和 actions 调用
- 确保组件能够高效订阅所需的 state slice，避免不必要的 re-render

**Non-Goals:**
- 不实现复杂的状态时间旅行（time-travel debugging）
- 不实现跨 Tab 同步（未来可扩展）
- 不实现服务端状态同步（书籍数据仍为本地优先）
- 不在此 change 中集成具体的业务逻辑（如 MCP 调用、RAG 检索）

## Decisions

### D1: 状态管理库选择 — Zustand vs Redux/MobX

**决策**: 使用 Zustand v4+ 作为全局状态管理库

**理由**:
- **轻量级**: ~1KB gzipped，符合极简主义设计哲学
- **简单 API**: 无需 actions/reducers/dispatch 的 boilerplate，直接在 store 中定义 setState
- **原生 TypeScript 支持**: 完整的类型推导，无需额外配置
- **Middleware 生态**: 内置 `persist` 中间件，满足持久化需求
- **宪法约束**: 明确规定使用 Zustand（第二章 2.1 节）

**替代方案 (已拒绝)**:
- **Redux**: 过重（~20KB），需要大量 boilerplate，违反宪法第二章 2.2 节禁止清单
- **MobX**: 基于 Proxy 的响应式系统，学习曲线陡峭，同样被宪法禁止

### D2: 持久化策略 — 部分持久化 vs 全量持久化

**决策**: 仅持久化关键业务数据到 localStorage，运行时状态不持久化

**持久化字段**:
- `books`: Book[] — 书籍列表和元数据
- `personas`: Persona[] — 角色配置
- `currentSession`: ChatSession | null — 当前对话会话

**非持久化字段 (仅运行时)**:
- `indexingProgress`: Record<string, number> — 向量化进度（重启后重置）
- `isGenerating`: boolean — LLM 生成状态（临时）
- `connectionStatus`: 'disconnected' | 'connecting' | 'connected' | 'error' — MCP 连接状态（临时）

**理由**:
- **数据一致性**: 运行时状态在应用重启后应重置，避免状态污染（如上次崩溃时 `isGenerating=true`）
- **存储优化**: 减少 localStorage 占用，避免存储大量临时数据
- **用户体验**: 关键业务数据（书籍、角色、对话）持久化保证用户数据不丢失

**存储方案 — localStorage vs IndexedDB**:
- 选择 **localStorage**: 同步 API，简单可靠，数据量可控（书籍元数据 < 1MB）
- IndexedDB 过于复杂，异步 API 增加复杂度，当前场景无需

### D3: Store 组织 — 单一 Store vs 多模块 Store

**决策**: 采用单一 Store（ImmerseStore），通过命名空间组织状态

**结构**:
```typescript
interface ImmerseStore {
  // === 书架状态 ===
  books: Book[];
  selectedBookId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  
  // === 阅读器状态 ===
  currentCfi: string | null;
  readerMode: 'read' | 'chat';
  
  // === 角色状态 ===
  personas: Persona[];
  activePersonaId: string | null;
  
  // === 对话状态 ===
  currentSession: ChatSession | null;
  isGenerating: boolean;
  
  // === RAG 状态 ===
  indexingProgress: Record<string, number>; // bookId -> 0-100
  
  // === Actions ===
  setBooks: (books: Book[]) => void;
  selectBook: (bookId: string) => void;
  addMessage: (message: Message) => void;
  // ... 更多 actions
}
```

**理由**:
- **符合宪法**: 严格遵循第五章 5.2 节的 ImmerseStore 接口定义
- **简化访问**: 所有状态通过 `useStore()` 统一访问，无需多个 provider
- **类型安全**: 单一接口定义，TypeScript 能完整推导所有字段

**替代方案 (已拒绝)**:
- **多模块 Store**: 如 `useBookshelfStore()`, `useChatStore()` 等分离 store
  - 增加复杂度，需要多个 Provider
  - 状态间依赖难以管理（如 Chat 依赖 Books）
  - 违反宪法定义的单一 ImmerseStore 接口

### D4: 类型安全 — 如何确保完整的类型推导？

**决策**: 显式定义 ImmerseStore 接口，使用 Zustand 的类型推导

**实现方式**:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Book, Persona, ChatSession, Message } from '@/shared/types';

interface ImmerseStore {
  // State fields (明确定义所有字段类型)
  books: Book[];
  selectedBookId: string | null;
  // ...
  
  // Actions (参数和返回值类型明确)
  setBooks: (books: Book[]) => void;
  selectBook: (bookId: string) => void;
  // ...
}

export const useStore = create<ImmerseStore>()(
  persist(
    (set) => ({
      // Initial state
      books: [],
      selectedBookId: null,
      // ...
      
      // Actions implementation
      setBooks: (books) => set({ books }),
      selectBook: (bookId) => set({ selectedBookId: bookId }),
      // ...
    }),
    {
      name: 'immerse-store',
      partialize: (state) => ({
        books: state.books,
        personas: state.personas,
        currentSession: state.currentSession,
      }),
    }
  )
);
```

**理由**:
- **类型推导**: Zustand 自动从接口推导出 `set` 函数的参数类型
- **无重复**: 不需要为每个 action 单独定义类型
- **编译检查**: TypeScript strict mode 下能捕获所有类型错误

### D5: 性能优化 — 如何避免不必要的 re-render？

**决策**: 使用 Zustand 的 selector 模式，组件只订阅所需的 state slice

**推荐用法**:
```typescript
// ❌ 错误：订阅整个 store，任何字段变化都会触发 re-render
const store = useStore();

// ✅ 正确：只订阅需要的字段
const books = useStore((state) => state.books);
const setBooks = useStore((state) => state.setBooks);

// ✅ 正确：订阅多个字段时使用 shallow 比较
import { shallow } from 'zustand/shallow';
const { books, selectedBookId } = useStore(
  (state) => ({ books: state.books, selectedBookId: state.selectedBookId }),
  shallow
);
```

**理由**:
- **Zustand 默认行为**: 使用严格相等比较（`===`），只有订阅的值变化才触发 re-render
- **Shallow 比较**: 订阅多个字段时使用 `shallow` 避免对象引用变化导致的重渲染
- **性能**: 大幅减少不必要的组件更新，尤其在 `books` 数组更新时

## Risks / Trade-offs

### [风险] localStorage 容量限制（通常 5-10MB）
**影响**: 书籍数量过多时可能达到存储上限  
**缓解**:
- 当前设计仅存储书籍元数据（Book 接口），不存储书籍内容（EPUB 文件仍在本地磁盘）
- 估算：100 本书 × ~5KB 元数据 ≈ 500KB，远低于限制
- 未来可扩展：迁移到 IndexedDB（支持更大存储）

### [权衡] 单一 Store 可能导致过大的状态树
**影响**: 随着功能增加，ImmerseStore 接口可能变得臃肿  
**缓解**:
- 当前设计已通过命名空间（books, personas, chat, rag）逻辑分组
- 受益：所有状态在一个对象中，便于调试和序列化
- 未来可扩展：如需拆分，可在不改变组件 API 的前提下重构为多个 store

### [权衡] 部分持久化需要手动配置 partialize
**影响**: 新增需要持久化的字段时需要手动更新 `partialize` 函数  
**缓解**:
- 在 store 定义处添加注释明确说明哪些字段持久化
- 使用 TypeScript 类型检查，如果遗漏字段会在 `partialize` 中报类型错误（需要显式 `omit`）

### [风险] localStorage 是同步 API，可能阻塞主线程
**影响**: 大量数据写入时可能造成 UI 卡顿  
**缓解**:
- 当前数据规模小（< 1MB），写入时间 < 10ms，用户无感知
- Zustand persist 中间件已优化：使用 debounce 策略，不会每次 setState 都写入
- 未来可扩展：如需优化，可切换到异步存储（IndexedDB）

## Migration Plan

**部署步骤**:
1. 安装依赖：`npm install zustand@^4.5.0`
2. 创建 `src/shared/store/index.ts`
3. 定义 ImmerseStore 接口（从 `@/shared/types` 导入）
4. 实现 Zustand store 并导出 `useStore` hook
5. 验证 TypeScript 编译通过（`npx tsc --noEmit`）
6. 验证 localStorage 持久化正常（手动测试：设置状态 → 刷新页面 → 检查状态恢复）

**Rollback 策略**:
- 本 change 不直接影响现有代码（纯新增文件）
- 如需回滚，删除 `src/shared/store/index.ts` 即可
- localStorage 中的数据不影响应用运行（仅在 useStore 调用时读取）

**无数据迁移需求**: 首次创建，无旧数据需要迁移

## Open Questions

<!-- 无悬而未决的问题，设计已明确 -->
