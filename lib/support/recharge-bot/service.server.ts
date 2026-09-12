import "server-only";
import { ImapFlow } from "imapflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentIntentByIdInternal } from "@/lib/payments/payment-intents.server";
import { resolveDepositFeeForSession } from "@/lib/payments/resolve-hecom-deposit-fee.server";
import { resolveUsdPenRateForQuote } from "@/lib/payments/manual-deposit.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { analyzePaymentVoucher, hashVoucherBuffer } from "@/lib/payments/voucher-analysis.server";
import { checkVoucherUploadRateLimits, normalizeOperationCode } from "@/lib/payments/voucher-security.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import type { SessionUser } from "@/types/auth";
import { BOT_SOURCE, RECIPIENT, paymentInstructions, verifiedProof } from "./policy";
import { verifyBankEmail } from "./bank-email.mjs";

export function botEnabled(email?: string): boolean {
  const emails=(process.env.SUPPORT_RECHARGE_BOT_PILOT_EMAILS??"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  return process.env.SUPPORT_RECHARGE_BOT_ENABLED === "true" && emails.length>0
    && (!email || emails.includes(email.toLowerCase()));
}

export async function ownedIntent(session: SessionUser, id: string) {
  const intent=await getPaymentIntentByIdInternal(id);
  if(!intent||intent.createdBy!==session.id||intent.metadata.source!==BOT_SOURCE||intent.currency!=="PEN")return null;
  const {data,error}=await createAdminClient().from("support_recharge_reservations").select("intent_id,expires_at,created_at,organization_id").eq("intent_id",id).eq("created_by",session.id).maybeSingle();
  if(error)throw new Error("No se pudo consultar la recarga del chat.");
  return data&&data.organization_id===intent.organizationId?{...intent,expiresAt:String(data.expires_at),createdAt:String(data.created_at)}:null;
}

export async function latestIntent(session: SessionUser) {
  const {data,error}=await createAdminClient().from("support_recharge_reservations").select("intent_id").eq("created_by",session.id)
    .gte("created_at",new Date(Date.now()-86400000).toISOString()).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error("No se pudo consultar la recarga del chat.");
  return data?ownedIntent(session,String(data.intent_id)):null;
}

type BotIntent=NonNullable<Awaited<ReturnType<typeof ownedIntent>>>;
export function intentView(intent: BotIntent) {
  const expired=Date.parse(intent.expiresAt)<Date.now();
  return {id:intent.id,status:intent.status,amountPenCents:intent.amountCents,creditUsdCents:Number(intent.metadata.credit_amount_cents),expiresAt:intent.expiresAt,expired,
    customerName:String(intent.metadata.hecom_cliente_name??"tu cuenta")};
}

export function intentMessages(intent: BotIntent): string[] {
  if(intent.status==="succeeded")return ["Pago confirmado. El saldo ya está en tu cartera Holistic; ahora puedes asignarlo a tu cuenta de TikTok."];
  if(["cancelled","failed"].includes(intent.status))return ["Esta recarga está cerrada. Si ya pagaste, contacta a soporte y no repitas el pago."];
  if(Date.parse(intent.expiresAt)<Date.now())return ["El plazo para pagar esta recarga terminó. Si ya pagaste dentro del plazo, adjunta el comprobante; si no, solicita ayuda a soporte. No envíes otro pago a esta recarga."];
  const m=intent.metadata;
  const fmt=(n:unknown)=>`S/ ${(Number(n)/100).toFixed(2)}`;
  return [
    `Recarga para ${String(m.hecom_cliente_name??"tu cartera")}: recibirás USD ${(Number(m.credit_amount_cents)/100).toFixed(2)}.`,
    paymentInstructions(intent.amountCents),
    `Saldo: ${fmt(m.credit_pen_cents)}\nComisión Holistic (${Number(m.fee_percent)}%): ${fmt(m.fee_pen_cents)}\nAjuste de identificación: ${fmt(m.pen_discriminator_cents)}\nTotal: ${fmt(intent.amountCents)}`,
    `Paga el monto exacto antes de las ${new Intl.DateTimeFormat("es-PE",{timeZone:"America/Lima",hour:"2-digit",minute:"2-digit"}).format(new Date(intent.expiresAt))}. Adjunta el comprobante en este chat. El saldo solo se acredita si coincide con el aviso auténtico del banco; una captura por sí sola no confirma el pago.`,
  ];
}

export async function createBotIntent(session:SessionUser,amount:number) {
  if(!process.env.YAPE_MAIL_USER||!process.env.YAPE_MAIL_PASSWORD||!process.env.OPENAI_API_KEY)throw new Error("El bot no está listo para recibir pagos. Contacta a soporte.");
  // Never request a real transfer when the receiving mailbox is unavailable.
  const mailbox=new ImapFlow({host:process.env.YAPE_MAIL_HOST||"imap.gmail.com",port:Number(process.env.YAPE_MAIL_PORT||993),secure:true,auth:{user:process.env.YAPE_MAIL_USER,pass:process.env.YAPE_MAIL_PASSWORD},logger:false,connectionTimeout:10000,socketTimeout:10000});
  mailbox.on("error",()=>{});
  try{
    await mailbox.connect();
    const lock=await mailbox.getMailboxLock(process.env.YAPE_MAIL_MAILBOX||"INBOX",{readOnly:true});
    lock.release();
  }catch{throw new Error("La conexión con el correo bancario no está disponible. No transfieras todavía; contacta a soporte.");}
  finally{await mailbox.logout().catch(()=>{});}
  const selected=await getSelectedHecomCliente(session.id);
  const org=selected?.id?await resolveOrganizationIdForHecomCliente(selected.id):session.organizationId;
  if(!org)throw new Error("No se encontró la cartera del cliente. Contacta a soporte antes de pagar.");
  const fee=await resolveDepositFeeForSession({userId:session.id,creditCents:Math.round(amount*100),hecomClienteId:selected?.id});
  const rate=await resolveUsdPenRateForQuote();
  const {data,error}=await createAdminClient().rpc("support_recharge_create",{p_org:org,p_actor:session.id,p_credit:Math.round(amount*100),p_fee:fee.feePercent,p_fx:rate,p_context:{hecom_cliente_id:fee.hecomClienteId,hecom_cliente_name:fee.hecomClienteName}});
  if(error)throw new Error("No se pudo abrir la recarga. El total debe superar S/ 10.00 y el crédito máximo de prueba es USD 100. Si ya tienes una recarga, consulta su estado.");
  const intent=await ownedIntent(session,String(data));
  if(!intent)throw new Error("No se pudo recuperar la recarga. No pagues todavía; contacta a soporte.");
  return intent;
}

export async function storeProof(session:SessionUser,id:string,file:File) {
  const intent=await ownedIntent(session,id);
  if(!intent||!["requires_payment","processing"].includes(intent.status))throw new Error("Esta recarga del chat no acepta comprobantes.");
  if(Date.now()-Date.parse(intent.createdAt)>86400000)throw new Error("Contacta a soporte para revisar este pago.");
  const limits=await checkVoucherUploadRateLimits(intent.organizationId);
  if(!limits.uploadAllowed||!limits.autoApproveAllowed)throw new Error("Alcanzaste el límite de comprobantes. Contacta a soporte y no repitas el pago.");
  const admin=createAdminClient();
  const {data:prior,error:priorError}=await admin.from("support_recharge_proofs").select("intent_id").eq("intent_id",id).maybeSingle();
  if(priorError)throw new Error("No se pudo verificar el comprobante anterior.");
  if(prior)return;
  const {data:attempt,error:attemptError}=await admin.rpc("support_recharge_claim_proof_attempt",{p_intent:id,p_actor:session.id});
  if(attemptError||attempt!==true)throw new Error("Se alcanzó el límite de cinco intentos de comprobante para esta recarga. Contacta a soporte y no vuelvas a pagar.");
  const buffer=Buffer.from(await file.arrayBuffer());
  const hash=hashVoucherBuffer(buffer);
  const analysis=await analyzePaymentVoucher({buffer,mimeType:file.type,expectedAmount:intent.amountCents/100,expectedCurrency:"PEN",holderNames:[RECIPIENT.holder],strictCurrency:true});
  const operation=normalizeOperationCode(analysis.operationCode);
  const {data:duplicates,error:duplicateError}=await admin.from("payment_intents").select("id").eq("status","succeeded").contains("metadata",{voucher_content_hash:hash}).limit(1);
  if(duplicateError||duplicates?.length)throw new Error("No se pudo validar que el comprobante sea nuevo. Contacta a soporte.");
  if(operation){
    const {data,error}=await admin.from("payment_intents").select("id").eq("status","succeeded").contains("metadata",{voucher_operation_code:operation}).limit(1);
    if(error||data?.length)throw new Error("Este código de operación requiere revisión de soporte.");
  }
  // Fail closed: never use trust_upload, beneficiary guesses, currency fallback or rounded amounts.
  if(!verifiedProof(analysis,intent.amountCents))throw new Error("No pudimos confirmar el monto exacto y el destinatario del comprobante. Adjunta una imagen clara o contacta a soporte. No vuelvas a pagar.");
  const path=`${intent.organizationId}/${id}/support-bot-${hash}.${file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg"}`;
  const {error:uploadError}=await admin.storage.from("payment-proofs").upload(path,buffer,{contentType:file.type,upsert:false});
  if(uploadError&&uploadError.message!=="The resource already exists")throw new Error("No se pudo guardar el comprobante. Inténtalo de nuevo.");
  const {error}=await admin.from("support_recharge_proofs").insert({intent_id:id,content_hash:hash,operation_code:operation,verified:true,amount_cents:intent.amountCents,storage_path:path,analysis});
  if(error)throw new Error("El comprobante ya fue registrado o requiere revisión de soporte.");
}

let pollInFlight:Promise<void>|null=null;
let lastPoll=0;
export async function pollBankAndReconcile() {
  if(!botEnabled())return;
  if(pollInFlight)return pollInFlight;
  if(Date.now()-lastPoll<15000)return reconcileReceipts();
  lastPoll=Date.now();
  pollInFlight=(async()=>{
    const admin=createAdminClient();
    const {data:open,error}=await admin.from("support_recharge_reservations").select("intent_id").gte("created_at",new Date(Date.now()-86400000).toISOString()).limit(1);
    if(error)throw new Error("No se pudo consultar la validación bancaria.");
    if(!open?.length)return;
    const client=new ImapFlow({host:process.env.YAPE_MAIL_HOST||"imap.gmail.com",port:Number(process.env.YAPE_MAIL_PORT||993),secure:true,auth:{user:process.env.YAPE_MAIL_USER??"",pass:process.env.YAPE_MAIL_PASSWORD??""},logger:false,connectionTimeout:12000,socketTimeout:15000});
    client.on("error",()=>{});
    try {
      await client.connect();
      const lock=await client.getMailboxLock(process.env.YAPE_MAIL_MAILBOX||"INBOX",{readOnly:true});
      try {
        const ids=await client.search({since:new Date(Date.now()-86400000),from:"notificacionesbcp.com.pe"},{uid:true});
        if(ids&&ids.length)for await(const message of client.fetch(ids.slice(-30).join(","),{source:true},{uid:true})){
          if(!message.source)continue;
          const receipt=await verifyBankEmail(message.source,process.env.YAPE_MAIL_USER??"");
          if(!receipt)continue;
          const {error:insertError}=await admin.from("support_recharge_receipts").upsert(receipt,{onConflict:"fingerprint",ignoreDuplicates:true});
          if(insertError)throw new Error("No se pudo registrar la confirmación bancaria.");
        }
      }finally{lock.release();}
    }finally{await client.logout().catch(()=>{});}
    await reconcileReceipts();
  })().finally(()=>{pollInFlight=null;});
  return pollInFlight;
}

export async function reconcileReceipts() {
  const admin=createAdminClient();
  const {data:receipts,error}=await admin.from("support_recharge_receipts").select("id,amount_cents,paid_at").is("matched_intent_id",null).eq("authenticated",true).gte("paid_at",new Date(Date.now()-86400000).toISOString()).limit(50);
  if(error)throw new Error("No se pudieron consultar las confirmaciones.");
  for(const receipt of receipts??[]){
    const {data:candidates,error:queryError}=await admin.from("support_recharge_reservations").select("intent_id,organization_id,created_by").eq("amount_cents",receipt.amount_cents).lte("created_at",receipt.paid_at).gte("expires_at",receipt.paid_at).limit(2);
    if(queryError||candidates?.length!==1)continue;
    const candidate=candidates[0];
    const {data:journal,error:confirmError}=await admin.rpc("support_recharge_confirm",{p_intent:candidate.intent_id,p_receipt:receipt.id});
    if(confirmError)throw new Error("La confirmación necesita revisión de soporte.");
    if(journal)await createNotificationBestEffort({organizationId:String(candidate.organization_id),userId:String(candidate.created_by),title:"Recarga confirmada",body:"El pago del chat fue verificado y el saldo ya está en tu cartera.",type:"payment_approved",data:{payment_intent_id:candidate.intent_id,url:"/payments"}});
  }
}
