import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {dkimSign} from 'mailauth/lib/dkim/sign.js';
import {verifyBankEmail} from '../lib/support/recharge-bot/bank-email.mjs';
import {wantsRecharge,desiredCredit,paymentInstructions,verifiedProof} from '../lib/support/recharge-bot/policy.ts';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'});
const publicKey=pair.publicKey.export({type:'spki',format:'der'}).toString('base64');
const mailbox='pilot@example.com';
const now=Date.now();
const resolver=async()=>[[`v=DKIM1; k=rsa; p=${publicKey}`]];
async function signed({body='Hola Holistic Marketing PE EIRL. Recibiste un yapeo de S/ 37.19 de CLIENTE DE PRUEBA.',domain='notificacionesbcp.com.pe',subject='Constancia de recepción de Yapeo a celular BCP',date=new Date(now).toUTCString(),to=mailbox,maxBodyLength}={}){
 const message=Buffer.from(`From: Avisos <alerta@${domain}>\r\nTo: ${to}\r\nDate: ${date}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body}\r\n`);
 const result=await dkimSign(message,{signTime:new Date(now-60000),headerList:['from','to','date','subject','content-type','mime-version','content-transfer-encoding'],signatureData:[{signingDomain:domain,selector:'test',privateKey,...(maxBodyLength!==undefined?{maxBodyLength}:{})}]});
 const source=Buffer.concat([Buffer.from(result.signatures),message]);
 return source;
}
const verify=source=>verifyBankEmail(source,mailbox,{resolver,now});
test('solo intenciones explícitas del chat; monto USD limitado',()=>{
 assert.equal(wantsRecharge('quiero recargar'),true);assert.equal(wantsRecharge('tengo un problema con una recarga'),false);
 for(const bad of ['0','-10','101','100.01','1e2','10 soles','964290361','quiero recargar 10 y 20','10.001'])assert.equal(desiredCredit(bad),null,bad);
 for(const valid of ['10','USD 10','quiero recargar 10','10 dólares'])assert.equal(desiredCredit(valid),10,valid);
});
test('datos de destino, banco, titular y ausencia de QR',()=>{
 const text=paymentInstructions(3719);for(const part of ['37.19','964290361','Holistic Marketing PE EIRL','BCP'])assert.ok(text.includes(part));
 assert.doesNotMatch(text,/QR|https?:|\*\*/);
});
test('OCR no permite confianza, diferencias de céntimos ni destinatario desconocido',()=>{
 const analysis={analysisMode:'openai_vision',confirmed:true,needsReview:false,beneficiaryMatch:true,detectedCurrency:'PEN',confidence:0.95,detectedAmount:37.19};
 assert.equal(verifiedProof(analysis,3719),true);
 for(const patch of [{analysisMode:'trust_upload'},{beneficiaryMatch:null},{detectedCurrency:'USD'},{confidence:0.89},{detectedAmount:37.2},{confirmed:false}])assert.equal(verifiedProof({...analysis,...patch},3719),false);
});
test('acepta recepción firmada completa y conserva los céntimos',async()=>{
 const receipt=await verify(await signed());assert.equal(receipt.amount_cents,3719);assert.equal(receipt.authenticated,true);
});
test('rechaza un correo sin firma aunque falsifique Authentication-Results',async()=>{
 const source=await signed();const raw=source.toString();const unsigned=raw.slice(raw.indexOf('From:'));
 assert.equal(await verify(Buffer.from('Authentication-Results: mx.google.com; dkim=pass\r\n'+unsigned)),null);
});
test('rechaza remitente de dominio parecido',async()=>assert.equal(await verify(await signed({domain:'notificacionesbcp.com.pe.evil.example'})),null));
test('rechaza monto alterado después de firmar',async()=>{
 const mail=await signed();assert.equal(await verify(Buffer.from(mail.toString().replace('37.19','99.99'))),null);
});
test('rechaza salida bancaria, aun firmada',async()=>assert.equal(await verify(await signed({body:'Holistic Marketing. Realizaste un yapeo. Monto enviado S/ 37.19.'})),null));
test('rechaza recibos antiguos y de otro destinatario',async()=>{
 assert.equal(await verify(await signed({date:new Date(now-2*86400000).toUTCString()})),null);
 assert.equal(await verify(await signed({to:'someone-else@example.com'})),null);
});
test('rechaza firmas que cubren solo parte del cuerpo',async()=>assert.equal(await verify(await signed({maxBodyLength:10})),null));
test('mismo correo reenviado no cambia la huella de pago',async()=>{
 const mail=await signed();const a=await verify(mail);const b=await verify(Buffer.concat([Buffer.from('X-Extra: replay\r\n'),mail]));assert.equal(a.fingerprint,b.fingerprint);
});
test('rechaza cabeceras críticas duplicadas',async()=>{
 const mail=await signed();assert.equal(await verify(Buffer.concat([Buffer.from('Subject: otra cabecera\r\n'),mail])),null);
});
