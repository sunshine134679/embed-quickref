# 术语搜索与翻译性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** 在保持现有搜索和翻译行为不变的前提下，降低本地搜索计算和翻译等待感。

**Architecture:** 抽出可独立测试的术语索引/搜索纯函数，`useSearch` 只负责词库和缓存生命周期。翻译流程先查缓存，快捷窗口复用现有 SSE 回调更新局部结果，最终结果仍由原入口提交。

**Tech Stack:** Vue 3、Vite、Tauri 2、Node.js `node:test`。

**Spec:** `docs/superpowers/specs/2026-08-28-search-translation-performance-design.md`

## Global Constraints

- 不改变术语搜索匹配优先级、分数和排序规则。
- 不改变翻译 API 配置格式、主模型优先级和备用模型顺序。
- 不修改发音、窗口动画、快捷键和用户数据文件。
- 索引或增量显示异常时必须保留可用的旧行为。

---

### Task 1: 建立术语索引回归测试

**Files:**
- Create: `src/utils/termSearchIndex.test.mjs`
- Create: `src/utils/termSearchIndex.js`

**Interfaces:**
- Produces `buildTermSearchIndex(terms)` and `searchTermIndex(index, query)` for `useSearch.js`.

- [ ] **Step 1: Write the failing test**

测试精确、前缀、中文、后缀和命令组合，并验证结果顺序。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/utils/termSearchIndex.test.mjs`

Expected: FAIL because `src/utils/termSearchIndex.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

实现索引预处理，并复制现有 `search()` 的评分和排序规则；索引记录保存原始词条对象。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/termSearchIndex.test.mjs`

Expected: PASS with 5 tests and 0 failures.

### Task 2: 接入术语索引并降低输入抖动

**Files:**
- Modify: `src/composables/useSearch.js:1-168`
- Modify: `src/App.vue:314-338`
- Modify: `package.json:scripts`
- Modify: `src/utils/termSearchIndex.test.mjs`

**Interfaces:**
- Consumes `buildTermSearchIndex` and `searchTermIndex` from Task 1.
- `search(query)` remains the public function and returns the same term objects.

- [ ] **Step 1: Write the failing regression assertion**

Add a fixture containing duplicate categories and user-like entries, then assert indexed output equals a reference implementation for all supported query forms.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/termSearchIndex.test.mjs`

Expected: FAIL on the new indexed/reference equivalence assertion before integration is complete.

- [ ] **Step 3: Write minimal implementation**

Cache the normalized index alongside `cachedAll`, invalidate both together, build it after terms load, and add a short `watch(query)` debounce in the main window. Explicit Enter/button search clears the timer and runs immediately.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/termSearchIndex.test.mjs`

Expected: PASS with unchanged result order.

### Task 3: Make translation cache-first and expose quick-window stream

**Files:**
- Modify: `src/composables/useTranslate.js:362-420`
- Modify: `src/components/QuickPanel.vue:207-248`
- Create: `src/utils/translationPerformance.test.mjs`

**Interfaces:**
- `translateQuery(text, settings, onDelta)` keeps its existing signature.
- QuickPanel supplies `(partial, target) => { ... }` only for sentence updates; final result still comes from `translateQuery`.

- [ ] **Step 1: Write the failing test**

Add a cache-first flow test that records the suggestion callback and asserts it is not called for a valid cached word, and a source contract test that requires QuickPanel to pass an increment callback.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/utils/translationPerformance.test.mjs`

Expected: FAIL because the current flow calls `suggestWords` before checking the cache and QuickPanel passes no stream callback.

- [ ] **Step 3: Write minimal implementation**

Move the word cache lookup before `suggestWords`, then pass the existing cumulative translation text into QuickPanel state while preserving sequence guards and final result handling.

- [ ] **Step 4: Run focused tests**

Run: `node --test src/utils/termSearchIndex.test.mjs src/utils/translationPerformance.test.mjs`

Expected: PASS with 0 failures.

### Task 4: Verify, build, deploy, and review the diff

**Files:**
- Modify only the files listed in Tasks 1–3.
- Deploy: `D:\EmbedQuickRef\EmbedQuickRef.exe` and its generated runtime assets.

- [ ] **Step 1: Run the full checks**

Run: `node --test src/utils/termSearchIndex.test.mjs src/utils/translationPerformance.test.mjs`

Expected: all tests pass.

Run: `npm run build`

Expected: Vite exits with code 0.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Inspect changed files and preserve unrelated work**

Run: `git status --short` and `git diff -- src/utils/termSearchIndex.js src/composables/useSearch.js src/composables/useTranslate.js src/components/QuickPanel.vue src/App.vue package.json tests`

Expected: only this feature's files are changed; existing `src-tauri/build.rs`, `.codegraph/`, and `Temp/` remain untouched.

- [ ] **Step 3: Deploy without touching user data**

Copy the generated executable/runtime assets to `D:\EmbedQuickRef` using the project's established deployment command or equivalent file copy, excluding `settings.json`, `state.json`, `user-terms.json`, and history data.

- [ ] **Step 4: Verify deployment**

Confirm `D:\EmbedQuickRef\EmbedQuickRef.exe` and its asset timestamps/sizes match the successful build, then report the deployment path.

- [ ] **Step 5: Commit the feature**

Run: `git add src/App.vue src/components/QuickPanel.vue src/composables/useSearch.js src/composables/useTranslate.js src/utils/termSearchIndex.js package.json tests docs/superpowers/specs/2026-08-28-search-translation-performance-design.md docs/superpowers/plans/2026-08-28-search-translation-performance.md` followed by `git commit -m "优化术语搜索与翻译响应性能"`.
