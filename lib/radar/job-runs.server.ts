import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Avance de los procesos diarios del Radar (tabla radar_job_runs). Permite
 * retomar una corrida cortada por tiempo o por límite de TikTok sin repetir
 * lo ya hecho, y no rehacer una corrida que ya terminó.
 */

export type RadarJobName = "discovery" | "ad-daily" | "liveness";
export type RadarJobStatus = "running" | "partial" | "complete" | "failed";

export type RadarJobRun = {
  status: RadarJobStatus;
  cursor: { done?: string[] } & Record<string, unknown>;
  stats: Record<string, unknown>;
};

export async function loadJobRun(job: RadarJobName, runDate: string): Promise<RadarJobRun | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_job_runs")
    .select("status, cursor, stats")
    .eq("job", job)
    .eq("run_date", runDate)
    .maybeSingle();
  if (error) throw new Error(`radar_job_runs: ${error.message}`);
  if (!data) return null;
  return {
    status: data.status as RadarJobStatus,
    cursor: (data.cursor ?? {}) as RadarJobRun["cursor"],
    stats: (data.stats ?? {}) as Record<string, unknown>,
  };
}

export async function saveJobRun(job: RadarJobName, runDate: string, run: RadarJobRun): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("radar_job_runs").upsert(
    {
      job,
      run_date: runDate,
      status: run.status,
      cursor: run.cursor,
      stats: run.stats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job,run_date" },
  );
  if (error) throw new Error(`radar_job_runs: ${error.message}`);
}

/** Corre `worker` de a `concurrency` hasta `deadlineMs`; devuelve los que no empezó. */
export async function forEachUntil<T>(
  items: T[],
  concurrency: number,
  deadlineMs: number,
  worker: (item: T) => Promise<void>,
): Promise<T[]> {
  let next = 0;
  let stop = false;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!stop && next < items.length && Date.now() < deadlineMs) {
      const item = items[next++]!;
      try {
        await worker(item);
      } catch (error) {
        stop = true;
        throw error;
      }
    }
  });
  await Promise.all(runners);
  return items.slice(next);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
