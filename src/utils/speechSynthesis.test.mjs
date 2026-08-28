import test from "node:test";
import assert from "node:assert/strict";

import { prepareSpeechSynthesis } from "./speechSynthesis.js";

test("播放系统语音前恢复可能处于暂停状态的语音引擎", () => {
  let resumed = 0;
  prepareSpeechSynthesis({ resume: () => { resumed += 1; } });
  assert.equal(resumed, 1);
});

test("没有 resume 接口时不阻断系统语音", () => {
  assert.doesNotThrow(() => prepareSpeechSynthesis({}));
});
