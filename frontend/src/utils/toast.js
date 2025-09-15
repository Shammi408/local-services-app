// src/utils/toast.js
// Simple toast utility — no dependencies.
// Usage: import { showToast } from "@/utils/toast"; showToast("Message", { type: "success", duration: 4000 });

const TOAST_CONTAINER_ID = "app-toasts-container";

function ensureContainer() {
  let c = document.getElementById(TOAST_CONTAINER_ID);
  if (c) return c;
  c = document.createElement("div");
  c.id = TOAST_CONTAINER_ID;
  Object.assign(c.style, {
    position: "fixed",
    right: "16px",
    top: "16px",
    zIndex: 99999,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "360px",
    pointerEvents: "none"
  });
  document.body.appendChild(c);
  return c;
}

export function showToast(message = "", opts = {}) {
  const { type = "info", duration = 4500 } = opts;
  const container = ensureContainer();
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  Object.assign(el.style, {
    pointerEvents: "auto",
    padding: "10px 12px",
    borderRadius: "10px",
    boxShadow: "0 6px 18px rgba(2,6,23,0.12)",
    background: type === "success" ? "#ecfdf5" : type === "error" ? "#ffefef" : "#eef2ff",
    color: type === "success" ? "#065f46" : type === "error" ? "#831f1f" : "#1e293b",
    fontSize: "14px",
    border: "1px solid rgba(0,0,0,0.04)",
    opacity: "0",
    transform: "translateY(-6px)",
    transition: "all 220ms ease"
  });
  el.innerText = message;
  container.appendChild(el);

  // animate in
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  const tid = setTimeout(() => remove(), duration);

  function remove() {
    clearTimeout(tid);
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
    setTimeout(() => {
      try { el.remove(); } catch (e) {}
    }, 230);
  }

  // allow click to dismiss
  el.addEventListener("click", remove);

  return { remove };
}
