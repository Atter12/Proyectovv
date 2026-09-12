"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { wantsRecharge, desiredCredit } from "@/lib/support/recharge-bot/policy";

type BotIntent={id:string;status:string;expired:boolean};
type Reply={handled?:boolean;state?:string;replies?:string[];intent?:BotIntent|null;error?:string};

export function useRechargeBot(append:(texts:string[],userText?:string)=>void) {
  const state=useRef("idle");
  const [pending,setPending]=useState<string|null>(null);
  const appendRef=useRef(append);
  useEffect(()=>{appendRef.current=append;},[append]);
  const router=useRouter();
  const notified=useRef(new Set<string>());

  function acceptIntent(intent?:BotIntent|null) {
    if(!intent)return;
    if(intent.status==="succeeded"||intent.status==="cancelled"||intent.status==="failed"){
      state.current="idle"; setPending(null);
      if(intent.status==="succeeded")router.refresh();
    }else setPending(intent.id);
  }

  useEffect(()=>{
    if(!pending)return;
    let cancelled=false; let ticks=0;
    let timer:ReturnType<typeof setTimeout>;
    async function poll() {
      if(cancelled)return;
      ticks++;
      try{
        const response=await fetch("/api/support/recharge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"check",intentId:pending})});
        const result=await response.json() as Reply;
        if(cancelled)return;
        if(result.intent?.status==="succeeded"){
          if(!notified.current.has(pending!)){
            notified.current.add(pending!);
            appendRef.current(["Pago confirmado. El saldo ya está en tu cartera Holistic; ahora puedes asignarlo a TikTok."]);
          }
          state.current="idle";setPending(null);router.refresh();return;
        }
      }catch{/* Keep the pending state; never infer payment success from a network error. */}
      if(cancelled)return;
      if(ticks>=30){appendRef.current(["La recarga sigue pendiente. No vuelvas a pagar. Escribe «estado de mi recarga» para consultar o solicita ayuda a soporte."]);return;}
      timer=setTimeout(()=>void poll(),10000);
    }
    timer=setTimeout(()=>void poll(),10000);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[pending,router]);

  async function handle(text:string,files:File[]):Promise<boolean> {
    const intentMessage=wantsRecharge(text)||/^(?:ya pagu[eé]|estado(?: de (?:mi |la )?recarga)?|retomar recarga)$/i.test(text.trim())||(state.current==="awaiting_amount"&&desiredCredit(text)!==null);
    if(files.length&&pending){
      if(files.length!==1)throw new Error("Adjunta un solo comprobante para esta recarga.");
      if(files[0].size>4*1024*1024)throw new Error("Adjunta una imagen de hasta 4 MB para esta recarga.");
      const form=new FormData();form.set("intentId",pending);form.set("proof",files[0]);
      const res=await fetch("/api/support/recharge",{method:"POST",body:form});
      const result=await res.json() as Reply;
      if(!res.ok||result.error)throw new Error(result.error??"No se pudo enviar el comprobante.");
      appendRef.current(result.replies??[],text||"Comprobante adjunto");acceptIntent(result.intent);return true;
    }
    if(files.length||!intentMessage){state.current="idle";setPending(null);return false;}
    const res=await fetch("/api/support/recharge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,state:state.current})});
    const result=await res.json() as Reply;
    if(!res.ok||result.error)throw new Error(result.error??"No se pudo consultar el bot.");
    if(!result.handled)return false;
    state.current=result.state??"idle";acceptIntent(result.intent);
    appendRef.current(result.replies??[],text);return true;
  }
  return {handle};
}
