import Link from "next/link";
import { routes } from "@/config/routes";

export function CreativeHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 p-8 text-white sm:p-12">
      <div className="absolute -right-16 top-0 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute -bottom-16 left-0 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="relative z-10 max-w-2xl">
        <h1 className="text-3xl font-bold sm:text-4xl">Creative Analyzer</h1>
        <p className="mt-3 text-base text-slate-300 sm:text-lg">
          Analyze, score &amp; generate new creatives from real data.
        </p>
        <Link
          href={routes.creativeAnalyzer}
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-indigo-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
        >
          Analyze your first video
        </Link>
      </div>
    </div>
  );
}
