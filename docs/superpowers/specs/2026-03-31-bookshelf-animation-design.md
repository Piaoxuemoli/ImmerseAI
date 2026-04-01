# 书架动效设计规格

## 概述

为书架页面书籍卡片添加三种交互动画：Hover 高亮、删除粒子效果、入场弹跳动画。

## 技术选型

- **动画库**: framer-motion v11（项目已集成）
- **动画原则**: 仅使用 transform + opacity 属性，确保 GPU 加速

---

## 1. Hover 动效

### 效果
- 卡片悬停时：放大 4%、上移 6px、边框发光、阴影扩散

### 实现
```tsx
<motion.button
  whileHover={{
    scale: 1.04,
    y: -6,
    boxShadow: "0 0 24px 6px rgba(99, 102, 241, 0.25)",
    borderColor: "hsl(238, 84%, 67%)"
  }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
```

### 参数
| 属性 | 值 | 说明 |
|------|-----|------|
| scale | 1.04 | 放大 4% |
| y | -6 | 上移 6px |
| boxShadow | 0 0 24px 6px rgba(99,102,241,0.25) | primary 色发光 |
| borderColor | hsl(238, 84%, 67%) | primary 色边框 |
| duration | 0.2s | 过渡时长 |

---

## 2. 删除动效（粒子爆炸）

### 效果
- 点击删除后：卡片分解为 12 个粒子向外扩散 → 透明度渐变至消失
- 持续时间：600ms

### 实现
- 使用 `AnimatePresence` + 自定义粒子组件
- 每个粒子独立随机方向、速度、旋转
- 粒子数量：12 个

### 参数
| 属性 | 值 |
|------|-----|
| 粒子数量 | 12 |
| 扩散半径 | 60-100px |
| 单粒子大小 | 6-12px |
| 持续时间 | 600ms |
| 缓动 | easeOut |

---

## 3. 入场弹跳动画

### 效果
- 新书加入书架时：从页面右上方飞入 → 落地弹跳两次衰减 → 稳定位置

### 实现
```tsx
<motion.div
  initial={{ x: "100vw", y: -100, opacity: 0, scale: 0.8 }}
  animate={{
    x: 0,
    y: [0, -20, 0, -10, 0],  // 弹跳两次
    opacity: 1,
    scale: 1
  }}
  transition={{
    duration: 0.8,
    times: [0, 0.3, 0.5, 0.7, 1],
    ease: "easeOut"
  }}
/>
```

### 参数
| 属性 | 值 | 说明 |
|------|-----|------|
| 起点 | x: 100vw, y: -100px | 屏幕右上方外 |
| 终点 | x: 0, y: 0 | 稳定位置 |
| 弹跳 | y: [0, -20, 0, -10, 0] | 两次弹跳衰减 |
| scale | 0.8 → 1 | 缩放入场 |
| duration | 0.8s | 总时长 |

---

## 文件变更

- `src/features/bookshelf/components/BookCardNew.tsx` - 添加 Hover + 入场动画
- `src/features/bookshelf/components/BookGridNew.tsx` - 添加 AnimatePresence + 删除粒子效果
- `src/styles/globals.css` - 添加粒子样式变量（如需要）

---

## 验证标准

1. Hover 时卡片平滑放大、无卡顿
2. 删除时粒子向四周扩散、卡片消失
3. 新书入场时有明显的弹跳效果
4. 动画帧率稳定在 60fps
