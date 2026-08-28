import assert from "node:assert/strict";
import test from "node:test";

import { focusAndSelectInput } from "./focusAndSelectInput.js";

test("快捷窗输入框先聚焦再全选已有内容", () => {
  const calls = [];
  const input = {
    focus: () => calls.push("focus"),
    select: () => calls.push("select"),
  };

  assert.equal(focusAndSelectInput(input), true);
  assert.deepEqual(calls, ["focus", "select"]);
});

test("输入框尚未挂载时不抛错", () => {
  assert.equal(focusAndSelectInput(null), false);
});
