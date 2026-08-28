import test from "node:test";
import assert from "node:assert/strict";

import { invokeNativeSpeech, prepareSpeechSynthesis } from "./speechSynthesis.js";

test("播放系统语音前恢复可能处于暂停状态的语音引擎", () => {
  let resumed = 0;
  prepareSpeechSynthesis({ resume: () => { resumed += 1; } });
  assert.equal(resumed, 1);
});

test("没有 resume 接口时不阻断系统语音", () => {
  assert.doesNotThrow(() => prepareSpeechSynthesis({}));
});

test("本机语音兜底优先调用原生 Windows 语音", async () => {
  const calls = [];
  const started = await invokeNativeSpeech(async (...args) => calls.push(args), "free", "us");
  assert.equal(started, true);
  assert.deepEqual(calls, [["speak_native", { text: "free", accent: "us" }]]);
});

test("原生语音调用失败时允许继续使用 Web Speech", async () => {
  const started = await invokeNativeSpeech(async () => { throw new Error("unavailable"); }, "free", "us");
  assert.equal(started, false);
});
