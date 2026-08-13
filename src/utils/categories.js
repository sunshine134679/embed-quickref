// 词库分类色标：内置 14 类 + AI 词条的"其他"，未命中的分类回退到中性灰
// fg 为文字色，bg 为浅色底（对比度接近既有 accent 浅底风格）
export const CATEGORY_COLORS = {
  网络协议: { fg: "#3a6ea5", bg: "rgba(58, 110, 165, 0.12)" },
  总线协议: { fg: "#5b5fc7", bg: "rgba(91, 95, 199, 0.12)" },
  内核与系统: { fg: "#5a6b7f", bg: "rgba(90, 107, 127, 0.12)" },
  构建与工具链: { fg: "#b06a1e", bg: "rgba(176, 106, 30, 0.12)" },
  硬件与存储: { fg: "#1b8a7d", bg: "rgba(27, 138, 125, 0.12)" },
  文件系统: { fg: "#1e8fa8", bg: "rgba(30, 143, 168, 0.12)" },
  文件后缀: { fg: "#7b8794", bg: "rgba(123, 135, 148, 0.12)" },
  "Linux 命令": { fg: "#2e8f4e", bg: "rgba(46, 143, 78, 0.12)" },
  "Shell 脚本": { fg: "#7a9b1f", bg: "rgba(122, 155, 31, 0.12)" },
  "Make 语法": { fg: "#b7791f", bg: "rgba(183, 121, 31, 0.12)" },
  "CMake 语法": { fg: "#9f4d73", bg: "rgba(159, 77, 115, 0.12)" },
  汇编指令: { fg: "#8a4fc0", bg: "rgba(138, 79, 192, 0.12)" },
  "Git 操作": { fg: "#cf5d2e", bg: "rgba(207, 93, 46, 0.12)" },
  "VSCode 配置": { fg: "#0284c7", bg: "rgba(2, 132, 199, 0.12)" },
  "U-Boot 命令": { fg: "#4c5fd7", bg: "rgba(76, 95, 215, 0.12)" },
  "Windows 命令": { fg: "#0e7490", bg: "rgba(14, 116, 144, 0.12)" },
  其他: { fg: "#6b7280", bg: "rgba(107, 114, 128, 0.12)" },
};

export function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS["其他"];
}
