import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const translateSource = fs.readFileSync(new URL("../composables/useTranslate.js", import.meta.url), "utf8");
const quickPanelSource = fs.readFileSync(new URL("../components/QuickPanel.vue", import.meta.url), "utf8");

test("单词翻译先查缓存再扫描拼写建议", () => {
  const cachePosition = translateSource.indexOf("let reply = cached(key)");
  const suggestionPosition = translateSource.indexOf("sugg = await suggestWords");
  assert.ok(cachePosition >= 0);
  assert.ok(suggestionPosition >= 0);
  assert.ok(cachePosition < suggestionPosition);
});

test("快捷窗口把句子翻译增量回调传给 translateQuery", () => {
  const callPosition = quickPanelSource.indexOf("const r = await translateQuery(text, settings.value");
  const callbackPosition = quickPanelSource.indexOf("(partial, target)", callPosition);
  assert.ok(callPosition >= 0);
  assert.ok(callbackPosition > callPosition);
});
