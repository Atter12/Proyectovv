import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url), ts=require('typescript');
const js=ts.transpileModule(readFileSync('lib/business-simulator/engine.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const engine={};vm.runInNewContext(js,{exports:engine,BigInt,Number,Date,Error});
const model=engine.createExample('2026-10','2026-10-31');
const [base,expansion,discount]=model.scenarios.map(s=>engine.calculate(s.inputs));
assert.equal(base.operating,300000);assert.equal(expansion.operating,525000);assert.equal(discount.operating,400000);
assert.equal(base.cashFlow,100000);assert.equal(base.receivable,200000);
assert.equal(engine.calculate({...model.scenarios[0].inputs,collectedBps:6000}).cashFlow,-100000);
assert.equal(engine.calculate({...model.scenarios[0].inputs,collectedBps:6000}).operating,base.operating);
assert.equal(engine.requiredVolume(model.scenarios[2].inputs,base.operating),22500000);
assert.equal(engine.requiredVolume({...model.scenarios[0].inputs,feeBps:50},base.operating),null);
assert.equal(engine.requiredVolume({...model.scenarios[0].inputs,feeBps:0},base.operating),null);
assert.equal(engine.calculate({...model.scenarios[0].inputs,volume:1,feeBps:5000}).fee,1,'Half-cent rounding must be half up');
assert.throws(()=>engine.calculate({...model.scenarios[0].inputs,volume:-1}));
assert.throws(()=>engine.calculate({...model.scenarios[0].inputs,feeBps:10001}));
assert.throws(()=>engine.calculate({...model.scenarios[0].inputs,volume:Infinity}));
assert.throws(()=>engine.parseModel({...model,version:'unknown'}));
assert.throws(()=>engine.parseModel({...model,month:'2026-13'}));
assert.throws(()=>engine.parseModel({...model,cutoff:'2026-02-30'}));
assert.equal(JSON.stringify(engine.parseModel(JSON.parse(JSON.stringify(model)))),JSON.stringify(model));
assert.equal(engine.calculate({...model.scenarios[0].inputs,fixedPaidBps:0}).payable,600000);
for(let fee=51;fee<1000;fee+=53){
  const input={...model.scenarios[0].inputs,feeBps:fee};
  const required=engine.requiredVolume(input,300000);
  assert.ok(required!==null && engine.calculate({...input,volume:required}).operating>=300000);
}
console.log('Business simulator: PDF examples, cash timing, break-even volume, rounding, input validation and versioned round-trip passed.');
// Independent decimal oracle plus conservation checks over 2,000 reproducible cases.
let seed=20261031;
const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
for(let i=0;i<2000;i++){
  const input={volume:next()%100000000,fixed:next()%1000000,feeBps:next()%10001,variableBps:next()%10001,collectedBps:next()%10001,variablePaidBps:next()%10001,fixedPaidBps:next()%10001};
  const output=engine.calculate(input);
  const fee=Math.floor((input.volume*input.feeBps+5000)/10000);
  const variable=Math.floor((input.volume*input.variableBps+5000)/10000);
  assert.equal(output.fee,fee);assert.equal(output.variableCost,variable);
  assert.equal(output.operating+output.totalCost,fee);
  assert.equal(output.collected+output.receivable,fee);
  assert.equal(output.paidCosts+output.payable,output.totalCost);
  assert.equal(output.cashFlow,output.collected-output.paidCosts);
}
const creditJs=ts.transpileModule(readFileSync('lib/business-simulator/credit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const credit={};vm.runInNewContext(creditJs,{exports:credit,BigInt,Number});
const client={requested:100000,debt:50000,overdue:0,overdueDays:0,payments:10,onTime:9,dueAmount:100000,cashAvailable:120000};
const policy={maxExposure:200000,maxOverdueDays:0,minOnTimeBps:9000,minPayments:5,minCoverageBps:12000};
const unit={netSale:10000,product:3000,fulfillment:1000,ads:2500,fees:500};
const review=(data=client,rules=policy)=>credit.reviewCredit(data,rules,'Estado de cuenta validado al 31/10/2026','Política de prueba v1',unit);
assert.equal(review().status,'within_policy');assert.equal(review().exposure,150000);
assert.equal(review({...client,cashAvailable:119999}).status,'outside_policy','Never round a failed coverage ratio up to the threshold');
assert.equal(review({...client,debt:110000}).status,'outside_policy');
assert.equal(review({...client,overdue:10000,overdueDays:1}).status,'outside_policy');
assert.equal(review({...client,overdue:10000,overdueDays:0}).status,'needs_data');
assert.equal(review({...client,cashAvailable:null}).status,'needs_data');
assert.equal(review(client,{...policy,maxExposure:null}).status,'needs_data');
assert.equal(review({...client,onTime:11}).status,'needs_data');
assert.equal(review({...client,payments:0,onTime:0}).status,'needs_data');
assert.equal(credit.reviewCredit(client,policy,'','').status,'needs_data');
assert.equal(review({...client,onTime:8}).status,'outside_policy');
assert.equal(credit.unitContribution(unit),3000);
assert.equal(credit.unitContribution({...unit,ads:11000}),-5500);
assert.equal(credit.reviewCredit(client,policy,'Datos validados','Política v1',{...unit,ads:11000}).status,'outside_policy','Unprofitable advertising must affect the review even with good payment ratios');
assert.equal(credit.reviewCredit(client,policy,'Datos validados','Política v1',{...unit,ads:null}).status,'needs_data');
console.log('2,000 independent arithmetic cases and credit policy boundaries, missing data and consistency checks passed. No real credit decisions made.');
const costsJs=ts.transpileModule(readFileSync('lib/business-simulator/known-costs.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const costs={};vm.runInNewContext(costsJs,{exports:costs,Number,Math});
const costRows=[
 {status_cod:'collected',collected_amount:100,product_cost_amount:30,courier_cost_amount:10,currency:'USD'},
 {status_cod:'collected',collected_amount:200,product_cost_amount:50,courier_cost_amount:20,currency:'USD'},
 {status_cod:'failed',collected_amount:0,product_cost_amount:0,courier_cost_amount:10,currency:'USD'},
];
const known=costs.summarizeKnownCosts(costRows,'USD',60);
assert.equal(known.values.netSale,15000);assert.equal(known.values.product,4000);
assert.equal(known.values.fulfillment,2000,'Delivery losses must be included per collected sale');
assert.equal(known.values.ads,3000);assert.equal(known.values.fees,undefined);
assert.equal(costs.summarizeKnownCosts([],'USD',60).collected,0);
assert.equal(costs.summarizeKnownCosts([{...costRows[0],product_cost_amount:0}],'USD',60).values.product,undefined);
assert.equal(Object.keys(costs.summarizeKnownCosts([{...costRows[0],currency:'PEN'}],'USD',60).values).length,0);
assert.equal(costs.summarizeKnownCosts([{...costRows[0],currency:'PEN'}],'PEN',60).values.ads,undefined);
console.log('Known-cost import: recorded costs, failed delivery costs, absent values, missing sales and currency isolation passed.');
const routeJs=ts.transpileModule(readFileSync('app/api/simulator/known-costs/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const route={};let auth='staff',acting=false,selected=true,queryError=false,queriedStores=[];
const query={select(){return this;},in(key,ids){queriedStores=[...ids];return this;},gte(){return this;},lte(){return this;},order(){return this;},range(){return Promise.resolve({data:queryError?null:costRows,error:queryError?{message:'Source unavailable'}:null});}};
vm.runInNewContext(routeJs,{exports:route,URL,console,require(path){
 if(path==='next/server')return require(path);
 if(path.includes('session.server'))return {getSession:async()=>auth==='none'?null:{id:'userA',email:'staff@test.invalid',role:auth,profileStatus:'active'}};
 if(path.includes('funding-roles'))return {resolvePaymentsFundingCapabilities:async({role})=>({isStaff:role==='staff',isSuperAdmin:false})};
 if(path.includes('selected-cliente'))return {getActingAsCliente:async()=>acting,getSelectedHecomCliente:async()=>selected?{id:'clientA',name:'Client A'}:null};
 if(path.includes('supabase/admin'))return {createAdminClient:()=>({from:()=>query})};
 if(path.includes('db.server'))return {defaultProfitDateRange:()=>({from:'2026-10-01',to:'2026-10-30'})};
 if(path.includes('profit-snapshot'))return {getLinkedStoresForCliente:async(id)=>{assert.equal(id,'clientA');return [{id:'storeA',currency:'USD',isActive:true}];}};
 if(path.includes('holistic-spend'))return {loadHolisticTikTokSpendForCliente:async(input)=>{assert.equal(input.hecomClienteId,'clientA');return {rows:[{}],adSpend:60};}};
 if(path.includes('known-costs'))return costs;
 throw Error('Unexpected route import '+path);
}});
const request=()=>new Request('https://ads.test/api/simulator/known-costs?currency=USD&clientId=foreign&storeId=foreign');
auth='none';assert.equal((await route.GET(request())).status,401);
auth='owner';assert.equal((await route.GET(request())).status,403,'Owning a customer org is not agency staff access');
auth='staff';acting=true;assert.equal((await route.GET(request())).status,403);acting=false;
selected=false;assert.equal((await route.GET(request())).status,400);selected=true;
const costResponse=await route.GET(request());assert.equal(costResponse.status,200);
assert.equal((await costResponse.json()).values.product,4000);
assert.equal(JSON.stringify(queriedStores),JSON.stringify(['storeA']),'Foreign IDs in query string must not select another customer');
queryError=true;assert.equal((await route.GET(request())).status,502,'Source failures must not become zero cost');
console.log('Known-cost API: session/staff authorization, act-as restrictions, selected-customer isolation and source-failure behavior passed.');
