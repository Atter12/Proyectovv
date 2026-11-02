import assert from 'node:assert/strict';
import {creditRepayment,creditProposalForAi} from '../lib/business-simulator/credit-proposal.ts';
import {summarizeFunding} from '../lib/business-simulator/client-fee.ts';
const terms={principalCents:250000,feeBps:1000,days:7,currency:'USD'};
assert.equal(creditRepayment(terms).totalDueCents,275000);
assert.equal(creditRepayment({...terms,feeBps:0}).totalDueCents,250000);
assert.equal(creditRepayment({...terms,principalCents:5}).feeCents,1);
for(const patch of [{days:0},{days:1.5},{feeBps:10001},{principalCents:-1},{currency:'EUR'}])assert.throws(()=>creditRepayment({...terms,...patch}));
const p={id:'p',organization_id:'org',status:'succeeded',succeeded_at:'2026-10-01T00:00:00Z',metadata:{}};
const j={source_id:'p',organization_id:'org',status:'posted',currency:'USD',amount_cents:10000};
assert.equal(summarizeFunding([p,p],[j]).count,1);
assert.equal(summarizeFunding([p],[{...j,status:'reversed'}]).count,0);
assert.equal(summarizeFunding([p],[{...j,organization_id:'other'}]).count,0);
assert.equal(summarizeFunding([p],[j,j]).count,0);
const h=summarizeFunding([p,{...p,id:'q',succeeded_at:'2026-10-08T00:00:00Z'}],[j,{...j,source_id:'q',amount_cents:20000}]);
assert.equal(h.averageGapDays,7);assert.equal(h.typicalCreditUsdCents,15000);
console.log('PASS repayment, validation, rounding, funding isolation, duplicates and frequency');
const {readFileSync}=await import('node:fs');const {createRequire}=await import('node:module');const vm=await import('node:vm');const require=createRequire(import.meta.url),ts=require('typescript');
let auth='staff',acting=false,calls=0,aiKey='',aiRequest=null;
const route={};const code=ts.transpileModule(readFileSync('app/api/simulator/credit-analysis/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{exports:route,Date,Response,Request,Intl,Number,Set,AbortSignal,fetch:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/chat/completions');aiRequest=JSON.parse(options.body);return Response.json({choices:[{message:{content:'Propuesta recibida. Falta confirmar la capacidad de pago.'}}]});},require:name=>{
if(name==='next/server')return {NextResponse:{json:(b,i)=>Response.json(b,i)}};
if(name.includes('session.server'))return {getSession:async()=>auth==='none'?null:{id:'s',role:auth,profileStatus:'active'}};
if(name.includes('funding-roles'))return {resolvePaymentsFundingCapabilities:async()=>({isStaff:auth==='staff'})};
if(name.includes('selected-cliente'))return {getActingAsCliente:async()=>acting,getSelectedHecomCliente:async()=>({id:'a'})};
if(name.includes('cliente-dashboard'))return {getHecomClienteDashboard:async()=>{calls++;return null}};
if(name.includes('env.server'))return {serverEnv:{get openAiApiKey(){return aiKey;},openAiVisionModel:'test-model'}};
if(name.includes('credit-proposal'))return {creditRepayment,creditProposalForAi};
if(name.includes('/route'))return {GET:async()=>{calls++;return Response.json({},{status:503})}};
throw Error(name);
}});
const req=(body={clientId:'a',...terms})=>new Request('https://internal',{method:'POST',body:JSON.stringify(body)});
auth='none';assert.equal((await route.POST(req())).status,401);auth='owner';assert.equal((await route.POST(req())).status,403);auth='staff';acting=true;assert.equal((await route.POST(req())).status,403);acting=false;
assert.equal((await route.POST(req({clientId:'b',...terms}))).status,409);
assert.equal((await route.POST(req({clientId:'a',...terms,days:0}))).status,400);assert.equal(calls,0);
const response=await route.POST(req());assert.equal(response.status,200);const result=await response.json();assert.equal(result.totalDueCents,275000);assert.equal(result.signals.length,0);assert.ok(result.pending.length);assert.ok(result.aiNotice);assert.equal(result.aiSummary,null);
console.log('PASS analysis authorization, client scope, validation, missing sources and absent AI');
aiKey='test-key';
for(const currency of ['USD','PEN']){
 const input={clientId:'a',principalCents:100000,feeBps:1000,days:7,currency};
 const analyzed=await (await route.POST(req(input))).json();
 assert.equal(analyzed.terms.principalCents,100000);
 assert.equal(analyzed.feeCents,10000);
 assert.equal(analyzed.totalDueCents,110000);
 assert.ok(analyzed.aiSummary);
 const payload=JSON.parse(aiRequest.messages[1].content);
 assert.deepEqual(payload.propuesta,{
  capitalSolicitado:`${currency} 1000.00`,comisionPorcentaje:'10.00%',
  comisionImporte:`${currency} 100.00`,devolucionTotal:`${currency} 1100.00`,
  plazo:'7 días',alcance:'Un solo ciclo. Comisión única sobre el capital; sin renovación automática.'
 });
 assert.equal(payload.terms,undefined);assert.equal(payload.repayment,undefined);
 assert.doesNotMatch(aiRequest.messages[1].content,/principalCents|feeBps|100000|110000/);
 assert.match(aiRequest.messages[0].content,/no centavos/);
}
assert.equal(creditProposalForAi({...terms,principalCents:123456,feeBps:725}).capitalSolicitado,'USD 1234.56');
assert.equal(creditProposalForAi({...terms,principalCents:123456,feeBps:725}).comisionPorcentaje,'7.25%');
assert.equal(creditProposalForAi({...terms,principalCents:123456,feeBps:725}).comisionImporte,'USD 89.51');
assert.equal(creditProposalForAi({...terms,principalCents:5,feeBps:1000}).devolucionTotal,'USD 0.06');
console.log('PASS actual AI request: USD/PEN 1000 principal, 10% fee, 1100 total; fractional units and rounding');
