import "server-only";
import { isRecord } from "@/lib/records";

/** Clientes Hecom bloqueados por staff — no recargar ni reactivar en sync. */
const STAFF_BLOCKED_HECOM_CLIENTE_IDS = new Set([
  // 2026-11-03: owner confirms existing balances are agency credit; suspended pending repayment.
  "35b02fad-605f-4fe8-8e94-338e29664554",
  "c58831c7-e58a-43ea-9bd8-00499d0aa78f",
  "61bc8449-6b40-4cce-8cbf-3b925cdcc7b3",
  "4e509277-8c50-47fc-95a8-830453d1a5b8",

  "db572ee9-e816-4ac3-88fc-8db3c969f447", // Kevin Hernandez
  "b5541d6f-b1f7-4720-bf93-87c512263016", // Hernan Lora — 2026-10-02, sin saldo por pedido de gerencia
]);

/** Advertisers TikTok bloqueados (BM10 Kevin, Hernan Lora). */
const STAFF_BLOCKED_ADVERTISER_IDS = new Set([
  // Confirmed agency-credit accounts, including mirrors without customer metadata.
  "7626269348620238856",
  "7626269367927406610",
  "7626269453227016199",
  "7626273927133315090",
  "7626274387351715858",
  "7626274916232364039",
  "7626277008368009223",
  "7626277012667154450",
  "7626289672636973074",
  "7626292408296259591",
  "7626292509097918472",
  "7626292912313417746",
  "7626293066969661447",
  "7626293332607795208",
  "7626293629459595272",
  "7626294332546498568",
  "7626294486012035090",
  "7626295012921638920",
  "7626297003496095752",
  "7626297628166225928",
  "7626390375787429895",
  "7626391388888104967",
  "7626391400872525831",
  "7626393095391117330",
  "7626393229390413831",
  "7626393857764212754",
  "7626409348650024978",
  "7626409422496677906",
  "7626410468055187463",
  "7626410484631109640",
  "7626411086836973575",
  "7654343985766334485",
  "7654768073743876114",
  "7654768986573258760",
  "7654769237761310738",
  "7654781300959903751",
  "7654781317607014418",
  "7654781542186827784",
  "7655212338806734855",
  "7655212607590383623",
  "7655331834766884871",
  "7655332727289348104",
  "7655335715512926226",
  "7655355710714003463",
  "7655355772485992455",
  "7655355997126557714",
  "7655357646022737938",
  "7655357646022803474",
  "7655358401775173650",
  "7655358754342584328",
  "7655358847343525896",
  "7658582854351372306",
  "7660754372476043271",
  "7661041484623429650",
  "7661042649758973960",
  "7663366143462916103",
  "7663366252348686343",
  "7663366277565956114",
  "7663367315861471250",
  "7663367719426113544",
  "7663368163750166546",
  "7672085153908490248",
  "7672087540682915858",
  "7672226725136351253",
  "7672226806296199189",
  "7672467772357476372",
  "7672467942715113492",
  "7672471564633538581",
  "7672471862059892757",
  "7672474709536751637",
  "7672475055284174869",
  "7672518218761879573",
  "7672519689947398165",
  "7674667648878919700",
  "7674667734269050901",
  "7675783211279286279",
  "7675783952677896200",
  "7675784316465987591",
  "7675784661590671380",
  "7675785591670996999",
  "7675785863759642632",
  "7675786572585222162",
  "7675786652944760840",
  "7675787042314452999",
  "7675787042314584071",
  "7675787095593091090",
  "7675787157542961170",
  "7675789558177988626",
  "7675790998731161608",
  "7675791406978514952",
  "7683168322254323732",
  "7683739548232466452",
  "7685961616390635540",
  "7685962000949624852",
  "7686222955117985813",
  "7686223812332978197",
  "7686223986757304340",

  // 2026-11-03: reviewed accounts funded by an agency bridge; credit suspended by owner.
  "7646637746722766866",
  "7655354420745781256",
  "7675788689846353927",
  "7675788433108860946",
  "7675789143745675282",
  "7675788301218185234",
  // Hernan Lora (BM30, BM200, BM300)
  "7626390352800006151",
  "7626391513676906503",
  "7647225635513040916",
  "7647225268356300820",
  "7647225049560219668",
  "7688736873191784469",
  "7688737182290378773",
]);

export function isStaffBlockedHecomCliente(clienteId: string | null | undefined): boolean {
  const id = clienteId?.trim();
  return Boolean(id && STAFF_BLOCKED_HECOM_CLIENTE_IDS.has(id));
}

export function isStaffBlockedAdvertiserId(
  advertiserId: string | null | undefined,
): boolean {
  const id = advertiserId?.trim();
  return Boolean(id && STAFF_BLOCKED_ADVERTISER_IDS.has(id));
}

export function isStaffBlockedMetadata(metadata: unknown): boolean {
  if (!isRecord(metadata)) return false;
  return metadata.staff_blocked === true;
}

export function isStaffBlockedAdAccount(input: {
  status?: string | null;
  metadata?: unknown;
  externalAccountId?: string | null;
  hecomClienteId?: string | null;
}): boolean {
  if (input.status === "disabled" && isStaffBlockedMetadata(input.metadata)) {
    return true;
  }
  if (isStaffBlockedAdvertiserId(input.externalAccountId)) return true;
  if (isStaffBlockedHecomCliente(input.hecomClienteId)) return true;
  if (isStaffBlockedMetadata(input.metadata)) return true;
  if (isRecord(input.metadata)) {
    const clienteId = String(input.metadata.hecom_cliente_id ?? "").trim();
    if (isStaffBlockedHecomCliente(clienteId)) return true;
  }
  return false;
}

export function mergeStaffBlockMetadata(
  existing: unknown,
  input?: { reason?: string; blockedBy?: string },
): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {};
  base.staff_blocked = true;
  base.staff_blocked_at = base.staff_blocked_at ?? new Date().toISOString();
  if (input?.reason) base.staff_blocked_reason = input.reason;
  if (input?.blockedBy) base.staff_blocked_by = input.blockedBy;
  return base;
}

export function staffBlockStatusForUpsert(input: {
  existingMetadata?: unknown;
  externalAccountId?: string | null;
  hecomClienteId?: string | null;
  tiktokStatusKind?: "approved" | "suspended" | "unknown";
}): { blocked: boolean; status: "active" | "disabled" } {
  const blocked = isStaffBlockedAdAccount({
    metadata: input.existingMetadata,
    externalAccountId: input.externalAccountId,
    hecomClienteId: input.hecomClienteId,
  });

  if (blocked) {
    return { blocked: true, status: "disabled" };
  }

  if (input.tiktokStatusKind === "suspended") {
    return { blocked: false, status: "disabled" };
  }

  return { blocked: false, status: "active" };
}
