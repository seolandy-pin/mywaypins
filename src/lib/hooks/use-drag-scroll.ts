import { useEffect, useRef } from "react";

/**
 * Enables click-and-drag horizontal scrolling on a container (desktop).
 * Touch scrolling continues to work natively. Suppresses click events
 * fired right after a drag so child buttons don't trigger accidentally.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let didDrag = false;
    let startX = 0;
    let startScroll = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      isDown = true;
      didDrag = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) {
        didDrag = true;
        el.style.cursor = "grabbing";
        try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
      }
      if (didDrag) {
        el.scrollLeft = startScroll - dx;
        e.preventDefault();
      }
    };
    const endDrag = () => {
      isDown = false;
      el.style.cursor = "";
    };
    const onClickCapture = (e: MouseEvent) => {
      if (didDrag) {
        e.stopPropagation();
        e.preventDefault();
        didDrag = false;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("pointerleave", endDrag);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("pointerleave", endDrag);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return ref;
}
