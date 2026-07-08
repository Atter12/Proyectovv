"use client";

import type { ReactNode, PointerEvent } from "react";
import { useRef } from "react";

type AdminMotionFrameProps = {
  children: ReactNode;
};

export function AdminMotionFrame({ children }: AdminMotionFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame || event.pointerType === "touch") return;

    const rect = frame.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const sidebarInfluence = Math.max(0, Math.min(1, 1 - x * 2.65));
    const tiltY = (-4.25 + sidebarInfluence * 1.65).toFixed(3);
    const tiltX = ((0.5 - y) * sidebarInfluence * 1.55).toFixed(3);
    const lift = (18 + sidebarInfluence * 10).toFixed(2);
    const glow = (0.14 + sidebarInfluence * 0.13).toFixed(3);

    frame.style.setProperty("--admin-tilt-y", `${tiltY}deg`);
    frame.style.setProperty("--admin-tilt-x", `${tiltX}deg`);
    frame.style.setProperty("--admin-lift", `${lift}px`);
    frame.style.setProperty("--admin-depth-glow", glow);
  }

  function handlePointerLeave() {
    const frame = frameRef.current;
    if (!frame) return;

    frame.style.setProperty("--admin-tilt-y", "-4deg");
    frame.style.setProperty("--admin-tilt-x", "0deg");
    frame.style.setProperty("--admin-lift", "18px");
    frame.style.setProperty("--admin-depth-glow", "0.16");
  }

  return (
    <div
      ref={frameRef}
      className="admin-motion-frame"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  );
}
