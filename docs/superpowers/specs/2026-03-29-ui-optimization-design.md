# UI Optimization Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this design task-by-task.

**Goal:** Fix ~25 UI/UX issues across the ImmerseAI application, covering dark mode, accessibility, responsive design, animation, and component quality.

**Architecture:** All changes are local component/style modifications. No architecture changes. CSS variables and Tailwind theme tokens used throughout to ensure consistency.

**Scope:** Everything in docs/界面优化方案.md including Section 11 (reading themes + semantic colors).

---

## S-01: Sonner Toast Dark Mode

**Problem:** Sonner Toast classNames has no `dark:` variants.

**Solution:** Add dark mode classNames to sonner.tsx.

```tsx
// sonner.tsx
classNames: {
  toast: `
    group toast
    group-[.toaster]:bg-white group-[.toaster]:text-slate-950
    dark:group-[.toaster]:bg-slate-900 dark:group-[.toaster]:text-slate-50
  `,
  // ... add dark variants for description, close button, etc.
}
```

---

## S-02: Dark Muted Foreground Contrast

**Problem:** `215 18% 60%` lightness in muted foreground has insufficient contrast in dark mode.

**Solution:** Update `globals.css` HSL values to increase lightness in dark mode.

---

## S-03: Animation Duration CSS Variables

**Problem:** Components define their own `--transition-fast` variables.

**Solution:** Define centralized animation duration variables in `globals.css`.

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}
```

---

## S-04: MessageBubble Avatar Hardcoded Color

**Problem:** `bg-slate-800` not using theme variable.

**Solution:** Replace with theme variable or Tailwind `dark:` variant.

---

## R-01: TextViewer Font Size Responsive

**Problem:** Font size hardcoded at 18px, not responsive.

**Solution:** Use Tailwind responsive classes.

```tsx
className="text-base leading-relaxed sm:text-lg sm:leading-loose"
```

Add CSS variables:
```css
--reading-font-size: 16px;
--reading-line-height: 1.7;
```

---

## R-02: Markdown Headings Not Responsive

**Problem:** Heading styles lack `sm:` breakpoints.

**Solution:** Add responsive size classes.

```tsx
h1: ({ children }) => (
  <h1 className="text-2xl sm:text-3xl font-semibold...">
)
```

---

## R-03: Paragraph Detection Limited

**Problem:** Only tracks `p, h1-h6` tags, misses `ul, ol, blockquote, pre, li`.

**Solution:** Expand querySelectorAll.

```tsx
const paragraphs = containerRef.current.querySelectorAll(
  'p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, li'
)
```

---

## R-04: Mobile Line Height Too Dense

**Problem:** `lineHeight: 1.8` is cramped on small screens.

**Solution:** Use responsive Tailwind classes for line height.

---

## C-01: CitationPopup Not Using Portal

**Problem:** Absolute positioned popup inside ScrollArea cannot overlay full screen.

**Solution:** Use `createPortal` to render at `document.body`.

```tsx
{createPortal(
  <div ref={overlayRef} className="fixed inset-0 z-50...">,
  document.body
)}
```

---

## C-02: NoteConfirmation Hardcoded Colors

**Problem:** `bg-green-50` has no dark mode variant.

**Solution:** Add dark mode classes.

```tsx
className="... bg-green-50 dark:border-green-800 dark:bg-green-950/50"
```

---

## C-03: Message Timestamp Missing

**Problem:** No timestamp shown on messages.

**Solution:** Add timestamp display using date-fns.

```tsx
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

<span className="text-[10px] text-muted-foreground">
  {formatDistanceToNow(message.timestamp, { addSuffix: true, locale: zhCN })}
</span>
```

---

## C-04: Failed Messages No Retry

**Problem:** No retry option when message fails.

**Solution:** Add retry button/option in error state of MessageBubble.

---

## C-05: Streaming Response No Wait Indicator

**Problem:** No "thinking" state before AI starts output.

**Solution:** Add wait indicator when streaming starts.

```tsx
{isStreaming && streamingContent.length === 0 && (
  <div className="flex items-center gap-2 text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm">正在思考...</span>
  </div>
)}
```

---

## C-06: ChatInput No Character Count

**Problem:** No input length hint.

**Solution:** Add character counter.

```tsx
const MAX_CHARS = 4000

{input.length > MAX_CHARS * 0.8 && (
  <span className={input.length > MAX_CHARS ? 'text-red-500' : 'text-muted-foreground'}>
    {input.length} / {MAX_CHARS}
  </span>
)}
```

---

## B-01: BookCard Cover Color Contrast

**Problem:** White text on colored backgrounds has inconsistent contrast.

**Solution:** Adjust palette to use low-light backgrounds with light text.

```tsx
const COVER_COLORS = [
  { bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-600' },
  { bg: 'bg-red-900', text: 'text-red-100', border: 'border-red-800' },
  { bg: 'bg-emerald-800', text: 'text-emerald-100', border: 'border-emerald-700' },
  { bg: 'bg-amber-800', text: 'text-amber-100', border: 'border-amber-700' },
  { bg: 'bg-sky-900', text: 'text-sky-100', border: 'border-sky-800' },
  { bg: 'bg-violet-900', text: 'text-violet-100', border: 'border-violet-800' },
]
```

---

## B-02: LibrarianBar Fixed Bottom Overflow

**Problem:** History panel extends upward beyond content.

**Solution:** Adjust z-index and positioning logic.

---

## B-03: LibrarianBar Badge Hardcoded Blue

**Problem:** `bg-blue-500` not using theme.

**Solution:** Use `bg-primary text-primary-foreground`.

---

## B-04: LibrarianBar No Mobile Safe Area

**Problem:** iOS bottom safe area not handled.

**Solution:** Add `pb-[env(safe-area-inset-bottom)]`.

---

## P-01: PersonaSelector No Keyboard Navigation

**Problem:** Only clickable, no keyboard access.

**Solution:** Add keyboard event handlers (Arrow keys, Enter, Space).

---

## P-02: PersonaSelector Missing ARIA Attributes

**Problem:** Missing `aria-expanded`, `aria-haspopup`, etc.

**Solution:** Add proper ARIA attributes to trigger and listbox.

---

## P-03: PersonaSelector Uses window.confirm

**Problem:** Uses native `window.confirm` instead of Dialog.

**Solution:** Replace with AlertDialog component.

---

## P-04: PersonaSelector Icon Button Missing aria-label

**Problem:** Icon buttons lack screen reader labels.

**Solution:** Add descriptive `aria-label` attributes.

---

## T-01: PageTransition Duration Too Short

**Problem:** 0.18s below human perception threshold.

**Solution:** Increase to 0.25s and add scale transform.

```tsx
const variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
}
transition={{ duration: 0.25, ease: 'easeInOut' }}
```

---

## T-02: PageTransition Missing Scale

**Problem:** Only opacity + y transform, feels basic.

**Solution:** Add scale to variants as shown above.

---

## T-03: Mode Switch Animation Too Short

**Problem:** 0.15s doesn't match content change magnitude.

**Solution:** Increase to 0.2s with easeOut.

---

## RS-01: Chat Panel Fixed 420px

**Problem:** Not responsive on mobile.

**Solution:** Use responsive width.

```tsx
className="w-full sm:w-[420px] shrink-0 overflow-hidden"
```

---

## RS-02: Bookshelf Sidebar Fixed Width

**Problem:** Only expands at xl breakpoint.

**Solution:** Add `md:` breakpoint.

```tsx
className="w-40 shrink-0 ... md:w-48 xl:w-56"
```

---

## RS-03: View Toggle Touch Target Too Small

**Problem:** 32x32 not meeting 44x44 mobile touch requirement.

**Solution:** Increase size with `min-w-[44px] min-h-[44px]`.

---

## A-01: Icon Buttons Missing aria-label

**Problem:** Screen readers cannot identify icon button purpose.

**Solution:** Add `aria-label` to all icon buttons (refresh, settings, etc.).

---

## A-02: No Skip Link

**Problem:** Keyboard users cannot skip to main content.

**Solution:** Add skip link in App.tsx.

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute...">
  跳转到主内容
</a>
<main id="main-content">
```

---

## A-03: Dynamic Content Missing aria-live

**Problem:** Screen readers not notified of dynamic changes.

**Solution:** Add `aria-live="polite"` to chat messages, `role="status"` to toasts.

---

## A-04: PersonaSelector No Focus Indicator

**Problem:** No visible focus for keyboard users.

**Solution:** Add `focus-visible` styles.

---

## A-05: Dark Mode NoteConfirmation Contrast

**Problem:** Already covered by C-02.

**Solution:** See C-02.

---

## 11-01: Reading Theme Presets

**Problem:** Users want sepia/night reading modes.

**Solution:** Add CSS data attributes.

```css
[data-reading-theme="sepia"] {
  --background: 35 30% 95%;
  --foreground: 30 20% 20%;
}

[data-reading-theme="night"] {
  --background: 220 25% 8%;
  --foreground: 210 20% 90%;
}
```

---

## 11-02: Semantic Color Variables

**Problem:** Success/warning/error colors hardcoded.

**Solution:** Add semantic CSS variables.

```css
--success: 142 71% 45%;
--warning: 38 92% 50%;
--error: 0 72% 51%;
```

Use `bg-[hsl(var(--success))]` instead of `bg-green-50`.

---

## Summary

All fixes are local component/CSS changes. No architectural changes. Estimated ~25 fix items, all small-to-medium工作量. Organized by priority:

**High:** S-01, C-01, C-02, RS-01, A-01, P-01
**Medium:** R-01, C-03, B-01, T-01, P-02
**Low:** R-02, C-04, C-06, RS-02, A-02, T-02, 11-01, 11-02
