import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(file,imports={},globals={}){const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;const m={exports:{}};vm.runInNewContext('(function(require,module,exports){'+out+'\n})',{process:{env:{}},console,Map,Set,Date,Error,Promise,...globals})(id=>id in imports?imports[id]:new Proxy({},{get(_t,k){return ()=>{throw Error('Unexpected effect '+id+'.'+String(k))}}}),m,m.exports);return m.exports;}
const policy=load('lib/payments/credit-suspension.ts');const src=fs.readFileSync('lib/payments/credit-suspension.ts','utf8');const cid=src.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)[0],adv=src.match(/"(\d{16,})"/)[1];
for(const flag of ['agencyBmFunding','staffBmFunding','crossBmFunding','allowTikTokOverLedger']){assert.throws(()=>policy.assertAgencyCreditAllowed({clientId:cid,[flag]:true}),/Crédito suspendido/);assert.throws(()=>policy.assertAgencyCreditAllowed({advertiserId:adv,[flag]:true}),/Crédito suspendido/);policy.assertAgencyCreditAllowed({clientId:'not-in-cohort',[flag]:true});}
policy.assertAgencyCreditAllowed({clientId:cid,advertiserId:adv});
const account={id:'a',organization_id:'org',external_account_id:adv,metadata:{hecom_cliente_id:cid},platform:'tiktok',status:'active'};
function db(rows=account){return {from(t){assert.equal(t,'ad_accounts');const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:rows,error:null}),in:async()=>({data:rows,error:null})};return q}}}
const common={'./credit-suspension':policy,'@/lib/records':{isRecord:x=>!!x&&typeof x==='object'},'@/lib/payments/staff-block.server':{isStaffBlockedAdAccount:()=>false}};
const allocate=load('lib/payments/allocate-with-tiktok.server.ts',{...common,'@/lib/supabase/admin':{createAdminClient:()=>db()}});
await assert.rejects(()=>allocate.allocateWithOptionalTikTokFunding({organizationId:'org',adAccountId:'a',amountCents:100,requestedBy:'qa',agencyBmFunding:true,staffBmFunding:true}),/Crédito suspendido/);
const reclaim=load('lib/payments/reclaim-with-tiktok.server.ts',{...common,'@/lib/supabase/admin':{createAdminClient:()=>db()}});
await assert.rejects(()=>reclaim.reclaimFromAdAccountWithTikTok({organizationId:'org',adAccountId:'a',amountCents:100,requestedBy:'qa',allowTikTokOverLedger:true}),/Crédito suspendido/);
const transfer=load('lib/payments/transfer-between-ad-accounts.server.ts',{...common,'@/lib/supabase/admin':{createAdminClient:()=>db([{...account,id:'a'},{...account,id:'b'}])}});
await assert.rejects(()=>transfer.transferBetweenAdAccountsWithTikTok({organizationId:'org',fromAdAccountId:'a',toAdAccountId:'b',amountCents:100,requestedBy:'qa',agencyBmFunding:true}),/Crédito suspendido/);
const lock=load('lib/payments/credit-lock/credit-lock.server.ts',{'../credit-suspension':policy,'../stripe-policy':{STRIPE_PAYMENTS_ENABLED:false}});
await assert.rejects(()=>lock.reviewCreditLockRequest({organizationId:'org',hecomClienteId:cid,decision:'approved',reviewedBy:'qa'}),/Crédito suspendido/);
await assert.rejects(()=>lock.assertCreditLockAllowsAllocate({organizationId:'org',hecomClienteId:cid,agencyBmFunding:true,staffBmFunding:true}),/Crédito suspendido/);
await lock.assertCreditLockAllowsAllocate({organizationId:'org',hecomClienteId:cid,agencyBmFunding:false});
assert.match(fs.readFileSync('lib/payments/prepago-guard.server.ts','utf8'),/CONFIRMED_CREDIT_CLIENTES\.has\(hecomId\.toLowerCase\(\)\) && !isCreditSuspended\(hecomId\)/);
console.log('Credit suspension: allocation, transfer, balance import and approval reject before effects; staff/disabled card lock cannot bypass; prepaid and other customers unchanged.');
const staff=load('lib/payments/staff-block.server.ts',{'server-only':{},'@/lib/records':{isRecord:x=>!!x&&typeof x==='object'}});
for(const client of ['35b02fad-605f-4fe8-8e94-338e29664554','c58831c7-e58a-43ea-9bd8-00499d0aa78f','61bc8449-6b40-4cce-8cbf-3b925cdcc7b3','4e509277-8c50-47fc-95a8-830453d1a5b8']){
 assert.equal(staff.isStaffBlockedAdAccount({metadata:{hecom_cliente_id:client}}),true);
 assert.equal(staff.staffBlockStatusForUpsert({hecomClienteId:client,tiktokStatusKind:'approved'}).status,'disabled');
}
assert.equal(staff.isStaffBlockedAdAccount({externalAccountId:'7686223986757304340'}),true,'mirror remains blocked without metadata');
assert.equal(staff.isStaffBlockedAdAccount({hecomClienteId:'a71c1511-611c-4e34-86ce-7811240777e4'}),false,'a similar name or ID prefix never blocks another customer');
assert.equal(staff.staffBlockStatusForUpsert({hecomClienteId:'unrelated',tiktokStatusKind:'approved'}).status,'active');
console.log('Confirmed credit accounts: allocation and sync remain blocked by exact customer/account identity.');

let chosenBudget=null,refundAmount=null;
const freeze=load('lib/ops/frenar-gasto.server.ts',{'server-only':{},'@/lib/hecom/bm-bucket.shared':{HECOM_BM_BUCKET_TO_BC:{'10':'bc10','300':'bc300'}},'@/lib/env/env.server':{serverEnv:{tiktokAccessToken:'synthetic'}},'@/lib/integrations/tiktok/bc-finance.server':{setSharedBmAdvertiserBudgetAbsolute:async input=>{chosenBudget=input.budgetUsd;return {newBudget:chosenBudget}}}}, {fetch:async(url,options)=>{if(options.method==='POST'){refundAmount=JSON.parse(options.body).cash_amount;return {text:async()=>JSON.stringify({code:0})}}return {text:async()=>JSON.stringify({code:0,data:{advertiser_account_list:[{advertiser_id:'synthetic',budget:646.45,budget_cost:646.44,budget_mode:'CUSTOM_BUDGET',valid_cash_balance:1.15}]}})}}});
const stopped=await freeze.bajarSaldoCuenta({bm:'10',advertiserId:'synthetic',amountUsd:null});
assert.equal(chosenBudget,646.44);assert.equal(stopped.leftUsd,0,'binary precision must not leave one cent of credit');
const refunded=await freeze.bajarSaldoCuenta({bm:'300',advertiserId:'synthetic',amountUsd:null});
assert.equal(refundAmount,1.15);assert.equal(refunded.leftUsd,0,'binary precision must not retain a paid cent');
console.log('Spend stop: exact cents for shared budgets and cash refunds.');
