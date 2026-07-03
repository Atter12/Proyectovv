import { Card } from "@/components/ui/Card";
import type { AffiliateMilestone } from "@/types/affiliate";

interface AffiliateMilestonesProps {
  milestones: AffiliateMilestone[];
}

export function AffiliateMilestones({ milestones }: AffiliateMilestonesProps) {
  return (
    <div id="affiliate-milestones" className="scroll-mt-24">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#0f172a]">Hitos de comisión</h3>
        <p className="mt-1 text-sm text-[#64748b]">
          Alcanza niveles superiores a medida que crece tu red de referidos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {milestones.map((milestone) => (
          <Card
            key={milestone.id}
            className={`relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              milestone.isTop
                ? "ring-2 ring-[#7c3aed]/20"
                : ""
            }`}
          >
            {milestone.isTop && (
              <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#4056ff] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Top
              </span>
            )}

            <div className="flex items-start justify-between gap-2">
              <span className="rounded-lg bg-[#4056ff]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#4056ff]">
                {milestone.name}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.394 3.06M15.27 9.728a6.003 6.003 0 01-5.394-3.06m0 0A6.003 6.003 0 004.5 9.728" />
                </svg>
              </div>
            </div>

            <p className="mt-4 text-3xl font-bold tracking-tight text-[#0f172a]">
              {milestone.commission}
            </p>
            <p className="mt-1 text-xs text-[#64748b]">de comisión</p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-0 rounded-full bg-gradient-to-r from-[#4056ff] to-[#7c3aed]" />
            </div>
            <p className="mt-1 text-[10px] text-[#64748b]">Progreso: 0%</p>

            <p className="mt-4 text-sm font-medium text-[#0f172a]">
              {milestone.requirement}
            </p>
            <p className="mt-1 text-xs text-[#64748b]">{milestone.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
