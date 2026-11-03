import assert from 'node:assert/strict';
import {loadTs} from './test-hecom-debt-settlement.mjs';
function db({fail=false,partial=false}={}){return {from(table){let status=null;const rows=table==='hecom_cliente_user_links'?Array.from({length:501},(_,i)=>({hecom_cliente_id:'linked-'+i})): [{hecom_cliente_id:'paid-only'},{hecom_cliente_id:'linked-0'}];const q={select(){return q},eq(k,v){status=v;return q},order(){return q},async range(a,b){if(table==='payment_intents')assert.equal(status,'succeeded');return {data:rows.slice(a,partial?a:b+1),count:rows.length,error:fail?{message:'failed'}:null}}};return q}}}
const load=d=>loadTs('lib/hecom/ads-cliente-cohort.server.ts',{'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>d}}).listAdsHolisticClienteIds();
const ids=await load(db());assert.equal(ids.size,502);assert.ok(ids.has('linked-500'));assert.ok(ids.has('paid-only'));assert.ok(!ids.has('hecom-only'));
await assert.rejects(load(db({fail:true})),/No se pudo/);await assert.rejects(load(db({partial:true})),/incompleta/);
console.log('Ads cohort: complete pagination, successful payments, no imported Hecom-only customers, failures never become empty success.');
