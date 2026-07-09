import type { AdminMetricAccent } from "./AdminMetricCard";

const iconClass = "h-5 w-5";

export function AdminMetricIcon({
  accent,
  emphasized = false,
}: {
  accent: AdminMetricAccent;
  emphasized?: boolean;
}) {
  const strokeWidth = emphasized ? 2 : 1.75;
  switch (accent) {
    case "indigo":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
          <path
            d="M4 20V9l8-4 8 4v11"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "emerald":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
          <path
            d="M4 8.5V18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M3 8.5h18M7 8.5V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "amber":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
          <path
            d="M7 4h10a1 1 0 0 1 1 1v14l-6-3-6 3V5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M9 8h6M9 11h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "rose":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={emphasized ? "h-[1.35rem] w-[1.35rem]" : iconClass} aria-hidden>
          <path
            d="M12 8.25V8.26M12 16h.01"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d="M10.29 3.86 2.82 17.5a1.5 1.5 0 0 0 1.29 2.25h15.78a1.5 1.5 0 0 0 1.29-2.25L13.71 3.86a1.5 1.5 0 0 0-2.58 0Z"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}
