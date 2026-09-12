import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { botEnabled, latestIntent, ownedIntent, createBotIntent, intentMessages, intentView, storeProof, pollBankAndReconcile } from "@/lib/support/recharge-bot/service.server";
import { desiredCredit, wantsRecharge } from "@/lib/support/recharge-bot/policy";

export const runtime="nodejs";
export const maxDuration=60;
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});

async function authorize() {
  const session=await getSession();
  if(!session)return null;
  if(!hasPermission(session.permissions,"wallet:deposit")&&!hasPermission(session.permissions,"payments:create"))return null;
  return session;
}

export async function GET() {
  const session=await authorize();
  if(!session)return respond({error:"No autorizado."},401);
  if(!botEnabled(session.email))return respond({enabled:false});
  try{
    const intent=await latestIntent(session);
    return respond({enabled:true,intent:intent?intentView(intent):null});
  }catch{return respond({error:"No se pudo consultar la recarga."},503);}
}

export async function POST(request:Request) {
  const session=await authorize();
  if(!session)return respond({error:"No autorizado."},401);
  if(!botEnabled(session.email))return respond({handled:false,enabled:false});
  if(request.headers.get("origin")!==new URL(request.url).origin)return respond({error:"Origen no permitido."},403);
  if(Number(request.headers.get("content-length")??0)>4.5*1024*1024)return respond({error:"Archivo demasiado grande."},413);
  try{
    if(request.headers.get("content-type")?.startsWith("multipart/form-data")){
      const form=await request.formData();
      const id=form.get("intentId"); const file=form.get("proof");
      if(typeof id!=="string"||!(file instanceof File)||file.size<1||file.size>4*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type))return respond({error:"Adjunta un comprobante JPG, PNG o WEBP de hasta 4 MB."},400);
      const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const valid=file.type==="image/jpeg"?bytes[0]===255&&bytes[1]===216:file.type==="image/png"?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
      if(!valid)return respond({error:"El archivo no corresponde al formato indicado."},400);
      await storeProof(session,id,file);
      await pollBankAndReconcile().catch(()=>console.warn("[support-recharge] bank check pending"));
      const intent=await ownedIntent(session,id);
      return respond({handled:true,state:"awaiting_payment",intent:intent?intentView(intent):null,replies:[intent?.status==="succeeded"?"Pago confirmado. El saldo ya está en tu cartera.":"Comprobante recibido. Falta completar la confirmación bancaria. No vuelvas a pagar mientras esperas."]});
    }
    const body=await request.json() as {message?:unknown;state?:unknown;action?:unknown;intentId?:unknown};
    if(body.action==="check"&&typeof body.intentId==="string"){
      if(!await ownedIntent(session,body.intentId))return respond({error:"Recarga del chat no encontrada."},404);
      await pollBankAndReconcile().catch(()=>console.warn("[support-recharge] bank check pending"));
      const intent=await ownedIntent(session,body.intentId);
      return respond({handled:true,intent:intent?intentView(intent):null});
    }
    if(typeof body.message!=="string"||body.message.length>500)return respond({error:"Mensaje inválido."},400);
    const text=body.message.trim();
    const amount=desiredCredit(text);
    const statusRequest=/^(?:ya pagu[eé]|estado(?: de (?:mi |la )?recarga)?|retomar recarga)$/i.test(text);
    if(!wantsRecharge(text)&&!(body.state==="awaiting_amount"&&amount!==null)&&!statusRequest)return respond({handled:false,state:"idle"});
    const active=await latestIntent(session);
    if(active&&(["requires_payment","processing"].includes(active.status)||statusRequest))return respond({handled:true,state:"awaiting_payment",intent:intentView(active),replies:intentMessages(active)});
    if(amount===null)return respond({handled:true,state:"awaiting_amount",replies:["¿Cuánto saldo quieres recibir en dólares? En esta prueba, el máximo es USD 100 y el total a pagar debe superar S/ 10.00."]});
    const intent=await createBotIntent(session,amount);
    return respond({handled:true,state:"awaiting_payment",intent:intentView(intent),replies:intentMessages(intent)});
  }catch(error){
    return respond({error:error instanceof Error?error.message:"No se pudo procesar la recarga. Contacta a soporte."},400);
  }
}
