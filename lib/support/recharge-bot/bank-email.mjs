import { createHash } from 'node:crypto';
import { simpleParser } from 'mailparser';
import { dkimVerify } from 'mailauth/lib/dkim/verify.js';

const DOMAIN='notificacionesbcp.com.pe';

export async function publicKeyResolver(name,type) {
  if(type!=='TXT'||!name.includes('._domainkey.'))throw new Error('Unexpected DNS query');
  const response=await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Public key lookup unavailable');
  const data=await response.json();
  const values=(data.Answer??[]).filter(a=>a.type===16).map(a=>a.data.startsWith('"')?(a.data.match(/"(?:[^"\\]|\\.)*"/g)??[]).map(x=>JSON.parse(x)):[a.data]);
  if(!values.length)throw new Error('Public key unavailable');
  return values;
}

/** Strictly receive-only BCP template; never trust forwarded authentication headers. */
export async function verifyBankEmail(source, mailbox, options={}) {
  if(!source||source.length>1024*1024)return null;
  const mail=await simpleParser(source);
  const from=mail.from?.value??[];
  const to=Array.isArray(mail.to)?mail.to.flatMap(x=>x.value):mail.to?.value??[];
  if(from.length!==1||from[0].address?.split('@')[1]?.toLowerCase()!==DOMAIN)return null;
  if(!to.some(x=>x.address?.toLowerCase()===mailbox.toLowerCase()))return null;
  if(!/^Constancia de recepci[oó]n de Yapeo a celular BCP\b/i.test(mail.subject??''))return null;
  const auth=await dkimVerify(source,{resolver:options.resolver??publicKeyResolver});
  const signature=auth.results.find(r=>{
    const keys=(r.signingHeaders?.keys??'').toLowerCase().split(':').map(x=>x.trim());
    return r.signingDomain===DOMAIN && r.status?.result==='pass' && r.signatureTimeValid===true
      && r.algo==='rsa-sha256' && r.canonBodyLengthLimit===undefined
      && ['from','to','subject','date','content-type','content-transfer-encoding','mime-version'].every(k=>keys.includes(k));
  });
  if(!signature?.signature)return null;
  // Reject duplicated critical headers (a valid signature must not authenticate a different parsed header).
  if(['from','to','date','subject','content-type','content-transfer-encoding','mime-version'].some(k=>mail.headerLines.filter(h=>h.key===k).length!==1))return null;
  const body=String(mail.text??'').replace(/\s+/g,' ');
  if(/realizaste|monto enviado|yapeaste|enviaste/i.test(body))return null;
  if(!/holistic\s+marketing\s+pe\s+e\.?i\.?r\.?l\.?\b/i.test(body))return null;
  const match=/recibiste\s+un\s+yapeo\s+de\s+S\/\.?\s*(\d+(?:[.,]\d{3})*)[.,](\d{2})\b/i.exec(body);
  if(!match)return null;
  const amountCents=Number(match[1].replace(/[.,]/g,''))*100+Number(match[2]);
  const paidAt=mail.date?.getTime();
  const now=options.now??Date.now();
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||!paidAt||paidAt>now+30000||paidAt<now-86400000)return null;
  return {fingerprint:createHash('sha256').update(Buffer.from(signature.signature,'base64')).digest('hex'),amount_cents:amountCents,paid_at:new Date(paidAt).toISOString(),authenticated:true,signer:DOMAIN};
}
