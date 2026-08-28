import test from "node:test";
import assert from "node:assert/strict";
import { buildTermSearchIndex, searchTermIndex } from "./termSearchIndex.js";

const terms = [
  { abbr: "git", full: "Git", zh: "版本控制", definition: "分布式版本控制系统" },
  { abbr: "git commit", full: "Git Commit", zh: "提交", definition: "提交代码" },
  { abbr: "GPIO", full: "General Purpose Input Output", zh: "通用输入输出", definition: "芯片引脚" },
  { abbr: "h", full: "Header", zh: "头文件", definition: "C/C++ 头文件" },
  { abbr: "bootcmd", full: "Boot Command", zh: "启动命令", definition: "U-Boot 启动命令" },
];

test("索引搜索保留精确匹配优先级", () => {
  const index = buildTermSearchIndex(terms);
  assert.equal(searchTermIndex(index, "gpio")[0], terms[2]);
  assert.equal(searchTermIndex(index, "git")[0], terms[0]);
});

test("索引搜索支持中文和定义包含", () => {
  const index = buildTermSearchIndex(terms);
  assert.deepEqual(searchTermIndex(index, "版本控制"), [terms[0]]);
  assert.deepEqual(searchTermIndex(index, "启动命令"), [terms[4]]);
});

test("索引搜索支持点号后缀", () => {
  const index = buildTermSearchIndex(terms);
  assert.deepEqual(searchTermIndex(index, "main.h"), [terms[3]]);
  assert.deepEqual(searchTermIndex(index, ".h"), [terms[3]]);
});

test("索引搜索支持命令组合前缀", () => {
  const index = buildTermSearchIndex(terms);
  assert.deepEqual(searchTermIndex(index, "git commit -m").slice(0, 2), [terms[1], terms[0]]);
});

test("索引记录保留原始词条对象", () => {
  const index = buildTermSearchIndex(terms);
  assert.equal(index[0].term, terms[0]);
});
