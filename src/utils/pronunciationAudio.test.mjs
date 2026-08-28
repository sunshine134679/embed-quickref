import test from "node:test";
import assert from "node:assert/strict";

import {
  AUDIO_REQUEST_TIMEOUT_MS,
  PRONUNCIATION_LOOKUP_TIMEOUT_MS,
  AUDIO_PLAY_TIMEOUT_MS,
  isAudioResponse,
} from "./pronunciationAudio.js";

test("发音网络请求必须使用有限的超时时间", () => {
  assert.ok(AUDIO_REQUEST_TIMEOUT_MS > 0);
  assert.ok(AUDIO_REQUEST_TIMEOUT_MS <= 5000);
  assert.ok(PRONUNCIATION_LOOKUP_TIMEOUT_MS >= AUDIO_REQUEST_TIMEOUT_MS);
  assert.ok(PRONUNCIATION_LOOKUP_TIMEOUT_MS <= 5000);
});

test("音频播放等待必须快速结束，避免点击后长时间无反馈", () => {
  assert.ok(AUDIO_PLAY_TIMEOUT_MS > 0);
  assert.ok(AUDIO_PLAY_TIMEOUT_MS <= 2000);
});

test("只接受音频响应，避免把错误页或 JSON 当成音频缓存", () => {
  assert.equal(isAudioResponse({ headers: { get: () => "audio/mpeg" } }), true);
  assert.equal(isAudioResponse({ headers: { get: () => "audio/wav; charset=binary" } }), true);
  assert.equal(isAudioResponse({ headers: { get: () => "application/json" } }), false);
  assert.equal(isAudioResponse({ headers: { get: () => "text/html" } }), false);
  assert.equal(isAudioResponse({ headers: { get: () => "text/plain" } }), false);
});
