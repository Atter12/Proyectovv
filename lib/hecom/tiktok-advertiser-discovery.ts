import "server-only";
import type { HecomCliente, HecomTiktokAccount } from "@/lib/hecom/clientes.server";
import { advertiserMatchesCliente, normalizeAdvertiserName } from "@/lib/hecom/advertiser-match";
import {
  mergeTikTokAdvertiserIntoMap,
  resolveBcIdForHecomBucket,
  searchHolisticBcAdvertisersByKeyword,
  type TikTokBcAdvertiser,
  type TikTokBcAdvertiserStatusKind,
} from "@/lib/integrations/tiktok/bc-advertisers.server";

/** Hecom mapeado + sync on: operable aunque TikTok no devolvió estado explícito. */
export function resolveHecomMappedStatusKind(
  account: HecomTiktokAccount,
  liveKind: TikTokBcAdvertiserStatusKind,
): TikTokBcAdvertiserStatusKind {
  if (liveKind === "suspended") return "suspended";
  if (liveKind === "approved") return "approved";
  if (account.syncEnabled !== false) return "approved";
  return liveKind;
}

export function isHecomMappedAccountFundable(
  account: HecomTiktokAccount,
  statusKind: TikTokBcAdvertiserStatusKind,
): boolean {
  if (account.syncEnabled === false) return false;
  return statusKind !== "suspended";
}

export function buildAdAccountKeywordQueries(
  cliente: HecomCliente,
  hecomAccounts: HecomTiktokAccount[],
): string[] {
  const queries = new Set<string>();
  const name = cliente.name.trim();
  if (name.length >= 3) queries.add(name);

  const tokens = normalizeAdvertiserName(name)
    .split(" ")
    .filter((t) => t.length >= 3);
  if (tokens.length >= 2) {
    queries.add(`${tokens[0]} ${tokens[1]}`);
    queries.add(`${tokens[0]} ${tokens[1]} 10`);
  }

  for (const account of hecomAccounts) {
    const advName = account.advertiserName?.trim();
    if (advName && advName.length >= 3) queries.add(advName);
    if (account.bmBucket === "10" && tokens.length >= 2) {
      queries.add(`${tokens[0]} ${tokens[1]} 10.0`);
    }
  }

  return [...queries].slice(0, 6);
}

export async function discoverTikTokAdvertisersForCliente(input: {
  cliente: HecomCliente;
  hecomAccounts: HecomTiktokAccount[];
  liveById: Map<string, TikTokBcAdvertiser>;
  nameMatchedExtras: TikTokBcAdvertiser[];
  hecomIds: Set<string>;
}): Promise<number> {
  const keywords = buildAdAccountKeywordQueries(
    input.cliente,
    input.hecomAccounts,
  );
  let totalHits = 0;

  for (const keyword of keywords) {
    const keywordHits = await searchHolisticBcAdvertisersByKeyword({
      keyword,
    }).catch(() => [] as TikTokBcAdvertiser[]);
    totalHits += keywordHits.length;

    for (const row of keywordHits) {
      mergeTikTokAdvertiserIntoMap(input.liveById, row);
      const belongs =
        input.hecomIds.has(row.advertiserId) ||
        advertiserMatchesCliente(row.advertiserName, input.cliente.name);
      if (!belongs) continue;
      if (input.hecomIds.has(row.advertiserId)) continue;
      if (
        !input.nameMatchedExtras.some((x) => x.advertiserId === row.advertiserId)
      ) {
        input.nameMatchedExtras.push(row);
      }
    }
  }

  const bmBuckets = [
    ...new Set(
      input.hecomAccounts
        .map((a) => a.bmBucket?.trim())
        .filter((b): b is string => Boolean(b)),
    ),
  ];
  for (const bucket of bmBuckets) {
    const bcId = resolveBcIdForHecomBucket(bucket);
    const focalKeyword =
      input.hecomAccounts
        .find((a) => a.bmBucket === bucket)
        ?.advertiserName?.trim() || input.cliente.name.trim();
    if (focalKeyword.length < 3) continue;
    const focalHits = await searchHolisticBcAdvertisersByKeyword({
      keyword: focalKeyword,
      bcIds: [bcId],
    }).catch(() => [] as TikTokBcAdvertiser[]);
    totalHits += focalHits.length;
    for (const row of focalHits) {
      mergeTikTokAdvertiserIntoMap(input.liveById, row);
      const belongs =
        input.hecomIds.has(row.advertiserId) ||
        advertiserMatchesCliente(row.advertiserName, input.cliente.name);
      if (!belongs) continue;
      if (input.hecomIds.has(row.advertiserId)) continue;
      if (
        !input.nameMatchedExtras.some((x) => x.advertiserId === row.advertiserId)
      ) {
        input.nameMatchedExtras.push(row);
      }
    }
  }

  return totalHits;
}
