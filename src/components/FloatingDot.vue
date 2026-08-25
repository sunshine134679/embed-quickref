<script setup>
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Menu } from "@tauri-apps/api/menu";

const emit = defineEmits(["expand", "settings", "quit"]);

// 按住拖动（移动超阈值才交给系统拖动），单击展开
let downPos = null;
let dragging = false;

function onDotDown(e) {
  if (e.button !== 0) return;
  downPos = { x: e.clientX, y: e.clientY };
  dragging = false;
}

function onDotMove(e) {
  if (!downPos || dragging) return;
  const dx = e.clientX - downPos.x;
  const dy = e.clientY - downPos.y;
  if (Math.hypot(dx, dy) > 6) {
    dragging = true;
    getCurrentWindow().startDragging();
  }
}

function onDotUp() {
  if (!dragging && downPos) emit("expand");
  downPos = null;
  dragging = false;
}

async function onContextMenu(e) {
  e.preventDefault();
  const menu = await Menu.new({
    items: [
      { id: "expand", text: "展开", action: () => emit("expand") },
      { id: "settings", text: "设置", action: () => emit("settings") },
      { id: "quit", text: "退出", action: () => emit("quit") },
    ],
  });
  await menu.popup();
}
</script>

<template>
  <div
    class="floating-dot"
    aria-label="EmbedQuickRef，点击展开"
    @mousedown="onDotDown"
    @mousemove="onDotMove"
    @mouseup="onDotUp"
    @contextmenu.prevent="onContextMenu"
  >
    <div class="dot-core"></div>
  </div>
</template>

<style scoped>
.floating-dot {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  -webkit-app-region: no-drag;
  animation: dot-fade-in 160ms ease-out;
}

@keyframes dot-fade-in {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

.floating-dot:active {
  cursor: grabbing;
}

.dot-core {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(35, 48, 66, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.25),
    inset 0 -2px 6px rgba(0, 0, 0, 0.28),
    0 0 12px rgba(82, 112, 143, 0.4),
    0 0 24px rgba(82, 112, 143, 0.3),
    0 0 48px rgba(82, 112, 143, 0.15);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.floating-dot:hover .dot-core {
  transform: scale(1.06);
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.25),
    inset 0 -2px 6px rgba(0, 0, 0, 0.28),
    0 0 14px rgba(82, 112, 143, 0.5),
    0 0 28px rgba(82, 112, 143, 0.38),
    0 0 56px rgba(82, 112, 143, 0.2);
}

.floating-dot:active .dot-core {
  transform: scale(0.94);
}
</style>
