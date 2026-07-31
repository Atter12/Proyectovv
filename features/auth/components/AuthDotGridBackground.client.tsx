"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

type AuthDotGridTone = "dark" | "light";

export function AuthDotGridBackground({
  tone = "light",
}: {
  tone?: AuthDotGridTone;
}) {
  const isLight = tone === "light";

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={isLight ? 2.5 : 3}
        gap={22}
        baseColor={isLight ? "#c5cdd8" : "#4a382c"}
        activeColor={isLight ? "#ff781f" : "#ff981f"}
        proximity={180}
      />

      {isLight ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 72% 68% at 44% 46%, rgb(244 246 248 / 0.65) 0%, transparent 76%)",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(248_250_252_/_0.45)_0%,transparent_18%,transparent_82%,rgb(238_241_244_/_0.5)_100%)]" />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 65% at 42% 48%, rgb(28 22 18 / 0.4) 0%, rgb(28 22 18 / 0.18) 48%, transparent 74%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 52% 42% at 12% 8%, rgb(255 161 44 / 0.14), transparent 70%), radial-gradient(ellipse 45% 40% at 90% 90%, rgb(255 176 64 / 0.1), transparent 68%)",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(28_22_18_/_0.12)_0%,transparent_22%,transparent_78%,rgb(28_22_18_/_0.18)_100%)]" />
        </>
      )}
    </div>
  );
}
