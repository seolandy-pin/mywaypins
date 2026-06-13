import { useEffect, useRef } from "react";

/**
 * Enables click-and-drag horizontal scrolling plus vertical-wheel→horizontal
 * scrolling on a container (desktop UX). Touch scrolling continues to work
 * natively. Suppresses click events fired right after a drag so child buttons
 * don't trigger accidentally.
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
    let suppressClickUntil = 0;

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
      if (!didDrag && Math.abs(dx) > 4) {
        didDrag = true;
        el.style.cursor = "grabbing";
      }
      if (didDrag) {
        el.scrollLeft = startScroll - dx;
        e.preventDefault();
      }
    };
    const endDrag = () => {
      if (didDrag) suppressClickUntil = Date.now() + 250;
      isDown = false;
      el.style.cursor = "";
    };
    const onClickCapture = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const onWheel = (e: WheelEvent) => {
      // Map vertical wheel to horizontal scroll when the user isn't already
      // scrolling horizontally. Keeps shift+wheel native.
      if (e.deltaY === 0 || e.shiftKey) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= max - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return ref;
}
