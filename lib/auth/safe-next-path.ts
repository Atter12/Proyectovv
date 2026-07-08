export function resolveSafeNextPath(
  candidate: string | null | undefined,
  fallback: string,
  options?: { requiredPrefix?: string },
): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  if (options?.requiredPrefix && !candidate.startsWith(options.requiredPrefix)) {
    return fallback;
  }

  return candidate;
}
