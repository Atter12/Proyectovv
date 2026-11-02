import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync('lib/integrations/tiktok/bc-tiktok-qr.server.ts','utf8');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let assets = [], assignments = {}, identities = {}, calls = [];
class TikTokApiError extends Error {}
const exported = {};
const sandbox = { exports:exported, Date, Buffer, Error, console, require(path) {
  if (path === 'server-only') return {};
  if (path.includes('http.server')) return {TikTokApiError,tiktokRequest:async (input)=>{
    calls.push(input);
    if(input.path === '/bc/asset/admin/get/')return {list:assets,page_info:{total_page:1}};
    if(input.path === '/bc/asset/account/authorization/')return {bc_auth_qr_code:'https://tiktok.com/authorize/test'};
    if(input.path === '/bc/asset/advertiser/assigned/')return {list:(assignments[input.query.asset_id]||[]).map(advertiser_id=>({advertiser_id}))};
    if(input.path === '/identity/info/')return {identity_info:identities[input.query.identity_id]};
    throw Error('Unexpected endpoint '+input.path);
  }};
  if(path.includes('bc-finance'))return {resolveTikTokFinanceAccessToken:async()=>({token:'test-only'})};
  if(path.includes('encryption'))return {encryptJson:JSON.stringify,decryptJson:JSON.parse};
  throw Error('Unexpected import '+path);
}};
vm.runInNewContext(js,sandbox);
const session = {userId:'user',clienteId:'client',bcId:'bc',profileName:'myshop',advertiserIds:['ad1'],baseline:['other'],expiresAt:Date.now()+60000};
assert.throws(()=>exported.readQrSession(JSON.stringify(session),'other-user','client'),/otra sesión/);
assert.throws(()=>exported.readQrSession(JSON.stringify(session),'user','other-client'),/otra sesión/);
assert.throws(()=>exported.readQrSession(JSON.stringify({...session,expiresAt:0}),'user','client'),/venció/);
assert.throws(()=>exported.readQrSession('broken','user','client'),/no es válida/);
assets = [{asset_id:'other',asset_name:'myshop'}];
assignments = {other:['someone-elses-ad']}; identities = {other:{username:'myshop'}};
assert.equal(await exported.findAuthorizedProfile(session),null);
assert.equal(calls.some(c=>c.path==='/identity/info/'),false,'Must not reveal identities assigned to another customer');
assets = [{asset_id:'new',asset_name:'Different profile'}];
identities.new={username:'different'};
assert.equal(await exported.findAuthorizedProfile(session),null,'A concurrent QR authorization for another handle must not be selected');
assets[0].asset_name='MyShop';
assert.equal((await exported.findAuthorizedProfile(session)).assetId,'new');
assignments.other=['ad1']; assets=[{asset_id:'other',asset_name:'myshop'}];
assert.equal((await exported.findAuthorizedProfile(session)).assetId,'other','Existing profiles need a client advertiser assignment');
const started=await exported.startQrSession({...session,baseline:undefined,expiresAt:undefined});
assert.equal(started.authorizationUrl,'https://tiktok.com/authorize/test');
assert.equal(calls.find(c=>c.path==='/bc/asset/account/authorization/').body.is_ads_only_mode,true);
assert.equal(exported.qrError(Error('Advertiser does not grant you permission')).code,'TIKTOK_PERMISSION_REQUIRED');
assert.equal(exported.qrError(Error('Invalid parameter')).code,'TIKTOK_QR_FAILED');
assets.push({asset_id:'duplicate',asset_name:'myshop'});
await assert.rejects(exported.findAuthorizedProfile(session),/varios perfiles/);
assets=[{asset_id:'owned',asset_name:'myshop'}]; assignments={owned:[]};
assert.equal(await exported.findAuthorizedProfile({...session,advertiserIds:[],baseline:['owned']}),null,'An existing unassigned agency profile is not proof of ownership');
assert.equal((await exported.findAuthorizedProfile({...session,advertiserIds:[],baseline:['owned'],ownedAssetIds:['owned']})).assetId,'owned','A saved profile can be recognized without advertisers');
const disconnectInput={userId:'user',clienteId:'client',profileId:'saved',bcId:'bc',assetId:'asset',profileRevision:'r1',assignedIds:[]};
const disconnectTicket=exported.createDisconnectTicket(disconnectInput);
assert.equal(exported.readDisconnectTicket(disconnectTicket,'user','client','saved').purpose,'disconnect-tiktok-profile');
assert.throws(()=>exported.readDisconnectTicket(disconnectTicket,'user','foreign','saved'),/venció|otro cliente/);
assert.throws(()=>exported.readDisconnectTicket(disconnectTicket,'foreign-user','client','saved'),/venció|otro cliente/);
assert.throws(()=>exported.readDisconnectTicket(disconnectTicket,'user','client','another'),/venció|otro cliente/);
assert.throws(()=>exported.readDisconnectTicket(JSON.stringify({...disconnectInput,purpose:'qr',expiresAt:Date.now()+10000}),'user','client','saved'),/venció|otro cliente/);
assert.throws(()=>exported.readDisconnectTicket(JSON.stringify({...disconnectInput,purpose:'disconnect-tiktok-profile',expiresAt:0}),'user','client','saved'),/venció|otro cliente/);

// Exercise the actual route with provider/auth doubles; no network or customer writes.
const routeSource = readFileSync('app/api/integrations/tiktok/qr/route.ts','utf8');
const routeJs = ts.transpileModule(routeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const route = {}, bound = new Set(['ad1']); let writeCalls = 0, saveCalls = 0, accountRows = [
    {externalAccountId:'ad1',name:'one',status:'active',externalBusinessId:'30'},
    {externalAccountId:'ad2',name:'two',status:'active',externalBusinessId:'30'},
    {externalAccountId:'ad3',name:'three',status:'active',externalBusinessId:'200'},
];
const savedId='f0000000-0000-4000-8000-000000000001';
let ticketAds=['ad1','ad2'], startInput, savedProfiles=[], revoked=false, activeUser=true, selectedCliente=true;
let deleteCalls=0, unassignCalls=0, markedCalls=0, deleteFailure=false, keepAsset=false, disconnected=false, profileRevision='r1';
const routeSandbox = {exports:route,URL,Request,Response,console:{...console,info:()=>{},warn:()=>{}},require(path){
  if(path==='next/server')return require(path);
  if(path==='qrcode')return require(path);
  if(path.includes('session.server'))return {getSession:async()=>activeUser?({id:'user',profileStatus:'active',permissions:['adAccounts:create']}):null};
  if(path.includes('auth/permissions'))return {hasPermission:(p,k)=>p.includes(k)};
  if(path.includes('selected-cliente'))return {getSelectedHecomCliente:async()=>selectedCliente?({id:'client'}):null};
  if(path.includes('ad-accounts.server'))return {getHecomClienteAdAccountsOverview:async()=>({accounts:accountRows})};
  if(path.includes('bm-bucket'))return {HECOM_BM_BUCKET_TO_BC:{30:'bc',200:'other-bc',300:'default-bc'}};
  if(path.includes('bc-create-profiles'))return {resolveTikTokCreateBmForCliente:()=> '300'};
  if(path.includes('profile-links.server'))return {
    listSavedTikTokProfiles:async()=>savedProfiles,
    saveTikTokProfile:async input=>{saveCalls++;const saved={id:savedId,bcId:input.bcId,assetId:input.assetId,name:input.name};savedProfiles=[saved];return saved;},
    getSavedTikTokProfile:async(cliente,id)=>{if(cliente!=='client'||id!==savedId)throw Error('foreign profile');return {id:savedId,bcId:'bc',assetId:'profile',name:'myshop',createdAt:'2026-10-31T00:00:00Z',revision:profileRevision,...(disconnected?{disconnectedAt:'2026-10-31T01:00:00Z'}:{})};},
    markTikTokProfileDisconnected:async()=>{assert.equal(revoked,true,'Must confirm provider absence before local deactivation');markedCalls++;disconnected=true;profileRevision='r2';},
  };
  if(path.includes('bc-tiktok-qr.server'))return {
    ASSIGN_PATH:'/bc/asset/advertiser/assign/',UNASSIGN_PATH:'/bc/asset/advertiser/unassign/',REMOVE_PROFILE_PATH:'/bc/asset/admin/delete/',qrError:exported.qrError,
    createDisconnectTicket:exported.createDisconnectTicket,readDisconnectTicket:exported.readDisconnectTicket,
    startQrSession:async(input)=>{startInput=input;return {ticket:'ticket',expiresAt:Date.now()+10000,authorizationUrl:'https://tiktok.com/test'};},
    readQrSession:()=>({...session,advertiserIds:ticketAds}),
    findAuthorizedProfile:async()=>({assetId:'profile',name:'myshop'}),
    listBcTikTokAssets:async()=>revoked?[]:[{asset_id:'profile'}],
    assignedAdvertisers:async()=>[...bound],
    bcCall:async(path,bc,body)=>{
      if(path==='/bc/asset/admin/delete/'){deleteCalls++;assert.equal(body.asset_type,'TT_ACCOUNT');assert.equal(body.asset_ids.length,1);assert.equal(body.asset_ids[0],'profile');if(deleteFailure)throw Error('permission denied');if(!keepAsset)revoked=true;return;}
      if(path==='/bc/asset/advertiser/unassign/'){unassignCalls++;bound.delete(body.advertiser_id);return;}
      writeCalls++;bound.add(body.advertiser_id);
    },
  };
  throw Error('Unexpected route import '+path);
}};
vm.runInNewContext(routeJs,routeSandbox);
const request = (body,origin='https://ads.test')=>new Request('https://ads.test/api/integrations/tiktok/qr',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await route.POST(request({action:'start'},'https://attacker.test'))).status,403);
assert.equal((await route.POST(request({action:'start',profileName:'shop',advertiserIds:['foreign-ad']}))).status,400);
assert.equal((await route.POST(request({action:'start',profileName:'shop',advertiserIds:['ad1','ad3']}))).status,400);
const startedResponse=await route.POST(request({action:'start',profileName:'shop',advertiserIds:['ad1']}));
assert.equal(startedResponse.status,200);
assert.match((await startedResponse.json()).qrDataUrl,/^data:image\/png;base64,/);
const reconnectStart=await route.POST(request({action:'start',profileName:'shop',advertiserIds:[],reconnectProfileId:savedId}));
assert.equal(reconnectStart.status,200);assert.equal(startInput.bcId,'bc','Reauthorization must use the saved center even with zero advertisers');
assert.equal((await route.POST(request({action:'start',profileName:'shop',advertiserIds:['ad3'],reconnectProfileId:savedId}))).status,400);
assert.equal((await route.POST(request({action:'start',profileName:'shop',advertiserIds:[],reconnectProfileId:'f0000000-0000-4000-8000-000000000002'}))).status,400,'Cannot choose another client’s profile to authorize a center');
const linked=await (await route.POST(request({action:'link',ticket:'ticket'}))).json();
assert.equal(linked.results.every(r=>r.ok),true);
assert.equal(writeCalls,1,'Already-linked accounts must not be assigned twice');
await route.POST(request({action:'link',ticket:'ticket'}));
assert.equal(writeCalls,1,'Retry must skip already-linked accounts');

// Profile first, including zero advertisers: durable save without any assignment calls.
const originalAccounts=accountRows; accountRows=[]; ticketAds=[]; const writesBefore=writeCalls;
const noAdsStart=await route.POST(request({action:'start',profileName:'shop',advertiserIds:[]}));
assert.equal(noAdsStart.status,200); assert.equal(startInput.bcId,'default-bc'); assert.equal(startInput.advertiserIds.length,0);
const noAdsLink=await (await route.POST(request({action:'link',ticket:'ticket'}))).json();
assert.equal(noAdsLink.profile.id,savedId); assert.deepEqual(noAdsLink.results,[]);
assert.equal(writeCalls,writesBefore); assert.ok(saveCalls>0);
assert.equal((await (await route.GET()).json()).profiles.length,1,'Saved profile survives a fresh GET with no ads');

// Accounts created later can be added using only the stored profile ID, no QR ticket.
accountRows=originalAccounts; bound.clear();
const assignedLater=await route.POST(request({action:'assign',profileId:savedId,advertiserIds:['ad2']}));
assert.equal(assignedLater.status,200); assert.equal((await assignedLater.json()).results[0].ok,true);
await route.POST(request({action:'assign',profileId:savedId,advertiserIds:['ad2']}));
assert.equal(writeCalls,writesBefore+1,'Later assignment is also idempotent');
assert.equal((await route.POST(request({action:'assign',profileId:savedId,advertiserIds:['foreign-ad']}))).status,400);
assert.equal((await route.POST(request({action:'assign',profileId:savedId,advertiserIds:['ad3']}))).status,400);
assert.equal((await route.POST(request({action:'assign',profileId:'f0000000-0000-4000-8000-000000000002',advertiserIds:['ad1']}))).status,400);
bound.add('other-client-ad');
const detail=await (await route.POST(request({action:'profile',profileId:savedId}))).json();
assert.equal(detail.assignedIds.includes('other-client-ad'),false,'Never disclose another customer’s assignments');
revoked=true;
assert.equal((await route.POST(request({action:'assign',profileId:savedId,advertiserIds:['ad1']}))).status,409);
assert.equal(writeCalls,writesBefore+1,'Revoked access must not assign anything');
activeUser=false; assert.notEqual((await route.GET()).status,200); activeUser=true;
selectedCliente=false; assert.notEqual((await route.GET()).status,200);
console.log('TikTok QR: tenant isolation, expiry, profile matching, zero-ad QR and durable save, later assignments without QR, revoked access, cross-center rejection and idempotent retries passed.');

selectedCliente=true; revoked=false; bound.clear(); bound.add('ad1');
const verified=await (await route.POST(request({action:'profile',profileId:savedId}))).json();
assert.equal(verified.linked,true); assert.ok(verified.verifiedAt);
assert.equal((await route.POST(request({action:'unassign',profileId:savedId,advertiserIds:['ad1']}))).status,400);
assert.equal(unassignCalls,0,'No removal without confirmation');
assert.equal((await route.POST(request({action:'unassign',profileId:savedId,advertiserIds:['foreign-ad'],confirm:true}))).status,400);
assert.equal((await route.POST(request({action:'unassign',profileId:savedId,advertiserIds:['ad3'],confirm:true}))).status,400);
const unassigned=await route.POST(request({action:'unassign',profileId:savedId,advertiserIds:['ad1'],confirm:true}));
assert.equal(unassigned.status,200);assert.equal(bound.has('ad1'),false);assert.equal(markedCalls,0);
await route.POST(request({action:'unassign',profileId:savedId,advertiserIds:['ad1'],confirm:true}));
assert.equal(unassignCalls,1,'Unassign retry does not repeat provider mutation');
bound.add('foreign-ad');
assert.equal((await route.POST(request({action:'disconnect-preview',profileId:savedId}))).status,409);
assert.equal(deleteCalls,0,'Cannot revoke a profile affecting another client');
bound.clear();bound.add('ad1');
let preview=await (await route.POST(request({action:'disconnect-preview',profileId:savedId}))).json();
assert.equal(preview.assignedCount,1);assert.equal(deleteCalls,0,'Preview is read-only');
assert.equal((await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket}))).status,400);
bound.add('ad2');
assert.equal((await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket,confirm:true}))).status,409,'Stale assignment snapshot must be reviewed again');
assert.equal(deleteCalls,0);
preview=await (await route.POST(request({action:'disconnect-preview',profileId:savedId}))).json();
deleteFailure=true;
const rejectedDelete=await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket,confirm:true}));
assert.equal(rejectedDelete.status,400);assert.equal((await rejectedDelete.json()).code,'TIKTOK_PERMISSION_REQUIRED');assert.equal(markedCalls,0,'Keep saved record on permission failure');
deleteFailure=false;keepAsset=true;
assert.equal((await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket,confirm:true}))).status,409);
assert.equal(markedCalls,0,'Provider success alone is not proof of removal');
keepAsset=false;
assert.equal((await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket,confirm:true}))).status,200);
assert.equal(markedCalls,1);
assert.equal((await (await route.POST(request({action:'profile',profileId:savedId}))).json()).linked,false);
const mutations=deleteCalls;
// Old confirmation cannot remove a newly reauthorized profile.
disconnected=false;profileRevision='r3';revoked=false;
assert.equal((await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket,confirm:true}))).status,409);
assert.equal(deleteCalls,mutations);
// Reconcile an external revocation without another destructive provider call.
revoked=true;
preview=await (await route.POST(request({action:'disconnect-preview',profileId:savedId}))).json();
assert.equal(preview.linked,false);assert.equal(preview.assignedCount,0);
assert.equal((await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket,confirm:true}))).status,200);
assert.equal(deleteCalls,mutations);assert.equal(markedCalls,2);
revoked=false;disconnected=false;profileRevision='r4';bound.clear();
preview=await (await route.POST(request({action:'disconnect-preview',profileId:savedId}))).json();
assert.equal(preview.assignedCount,0);
assert.equal((await route.POST(request({action:'disconnect',profileId:savedId,ticket:preview.ticket,confirm:true}))).status,200);
assert.equal(deleteCalls,mutations+1);assert.equal(markedCalls,3,'Full unlink supports zero advertisers');
revoked=false;disconnected=false;profileRevision='r5';
accountRows.push({externalAccountId:'inactive-ad',name:'inactive',status:'disabled',externalBusinessId:'30'});bound.add('inactive-ad');
assert.equal((await route.POST(request({action:'unassign',profileId:savedId,advertiserIds:['inactive-ad'],confirm:true}))).status,200,'An owned inactive advertiser can still be unlinked');
assert.equal((await route.POST(request({action:'assign',profileId:savedId,advertiserIds:['inactive-ad']}))).status,400,'Inactive advertisers cannot be newly assigned');
console.log('TikTok disconnect: explicit confirmation, scoped tickets, foreign-account protection, stale snapshot rejection, permission failure, provider recheck, revocation reconciliation and reauthorization protection passed.');

// Real browser-side coordinator: one UI confirmation, scoped requests, partial failures and interruption.
const clientApi={}; const removalRequests=[]; let failAd=null, networkAd=null;
vm.runInNewContext(ts.transpileModule(readFileSync('features/ad-accounts/components/tiktok-connection-api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:clientApi,AbortController,setTimeout,clearTimeout,TypeError,Error,
  fetch:async(url,options)=>{
    assert.equal(url,'/api/integrations/tiktok/qr');
    const body=JSON.parse(options.body);removalRequests.push(body);
    assert.equal(body.action,'unassign');assert.equal(body.confirm,true);assert.equal(body.profileId,savedId);assert.equal(body.advertiserIds.length,1);
    if(body.advertiserIds[0]===networkAd)throw new TypeError('offline');
    return body.advertiserIds[0]===failAd?Response.json({error:'permission denied',code:'TIKTOK_PERMISSION_REQUIRED'},{status:400}):Response.json({state:'unassigned',advertiserId:body.advertiserIds[0]});
  },
});
const removalProgress=[];
let batch=await clientApi.unassignTikTokAccounts(savedId,['ad1','ad2','ad1'],(results,total)=>removalProgress.push([results.length,total]));
assert.equal(batch.length,2);assert.equal(batch.every(r=>r.ok),true);assert.equal(removalRequests.length,2,'Duplicate selected IDs are not removed twice');
assert.equal(JSON.stringify(removalProgress),JSON.stringify([[1,2],[2,2]]));
removalRequests.length=0;failAd='ad2';
batch=await clientApi.unassignTikTokAccounts(savedId,['ad1','ad2','ad3'],()=>{});
assert.equal(JSON.stringify(batch.map(r=>r.ok)),JSON.stringify([true,false,true]),'An advertiser-specific failure does not erase successes or block later accounts');
failAd=null;removalRequests.length=0;
await clientApi.unassignTikTokAccounts(savedId,batch.filter(r=>!r.ok).map(r=>r.advertiserId),()=>{});
assert.equal(JSON.stringify(removalRequests.map(r=>r.advertiserIds[0])),JSON.stringify(['ad2']),'Retry includes only pending accounts');
removalRequests.length=0;networkAd='ad2';
batch=await clientApi.unassignTikTokAccounts(savedId,['ad1','ad2','ad3','ad4'],()=>{});
assert.equal(removalRequests.length,2,'Stop starting requests after a lost connection');
assert.equal(batch[0].ok,true);assert.equal(batch[1].error.code,'NETWORK_ERROR');assert.equal(batch[2].error.code,'BATCH_INTERRUPTED');assert.equal(batch[3].error.code,'BATCH_INTERRUPTED');
assert.equal((await clientApi.unassignTikTokAccounts(savedId,[],()=>{})).length,0);
console.log('TikTok bulk unassign: deduplication, confirmed single-account requests, progress, partial failure, pending-only retries and network interruption passed.');

// Real persistence helper with an atomic in-memory storage double: concurrent claims and failure recovery.
const files=new Map(); let failIndexOnce=false;
const store={
  upload:async(path,body,opts)=>{if(failIndexOnce&&path.startsWith('clients/')){failIndexOnce=false;return {error:{statusCode:'500',message:'interrupted'}};}if(files.has(path)&&!opts.upsert)return {error:{statusCode:'409',message:'already exists'}};files.set(path,body);return {error:null};},
  download:async path=>files.has(path)?{data:{text:async()=>files.get(path)},error:null}:{data:null,error:{statusCode:'404'}},
  list:async prefix=>({data:[...files.keys()].filter(p=>p.startsWith(prefix+'/')).map(p=>({name:p.slice(prefix.length+1)})),error:null}),
};
const persist={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/integrations/tiktok/profile-links.server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:persist,Date,Error,Promise,require(path){
 if(path==='server-only')return {};
 if(path==='node:crypto')return require(path);
 if(path.includes('supabase/admin'))return {createAdminClient:()=>({storage:{from:()=>store}})};
 if(path.includes('encryption'))return {encryptJson:JSON.stringify,decryptJson:JSON.parse};
 throw Error('Unexpected persistence import '+path);
}});
const claimInput={clienteId:'clientA',userId:'userA',bcId:'bc',assetId:'asset',name:'shop'};
const race=await Promise.allSettled([persist.saveTikTokProfile(claimInput),persist.saveTikTokProfile({...claimInput,clienteId:'clientB',userId:'userB'})]);
assert.equal(race.filter(r=>r.status==='fulfilled').length,1,'Only one client can atomically claim the same profile');
const owner=(race[0].status==='fulfilled')?'clientA':'clientB';
const saved=race.find(r=>r.status==='fulfilled').value;
assert.equal((await persist.listSavedTikTokProfiles(owner))[0].id,saved.id);
assert.equal((await persist.listSavedTikTokProfiles(owner==='clientA'?'clientB':'clientA')).length,0);
await assert.rejects(persist.getSavedTikTokProfile(owner==='clientA'?'clientB':'clientA',saved.id));
assert.equal((await persist.saveTikTokProfile({...claimInput,clienteId:owner})).id,saved.id,'Repeat save preserves original claim ID');
failIndexOnce=true;
await assert.rejects(persist.saveTikTokProfile({...claimInput,assetId:'repair'}));
const repaired=await persist.saveTikTokProfile({...claimInput,assetId:'repair'});
assert.equal((await persist.getSavedTikTokProfile(owner,repaired.id)).assetId,'repair');
await persist.markTikTokProfileDisconnected(owner,saved.id);
assert.ok((await persist.getSavedTikTokProfile(owner,saved.id)).disconnectedAt);
assert.equal((await persist.listSavedTikTokProfiles(owner)).some(p=>p.id===saved.id),false,'Revoked records are hidden, not erased');
await assert.rejects(persist.saveTikTokProfile({...claimInput,clienteId:owner==='clientA'?'clientB':'clientA'}),/otro cliente/,'Revocation does not transfer ownership');
const reactivated=await persist.saveTikTokProfile({...claimInput,clienteId:owner});
assert.equal(reactivated.id,saved.id);assert.equal(reactivated.disconnectedAt,undefined);
assert.notEqual(reactivated.revision,saved.revision,'Reauthorization invalidates older removal tickets');
console.log('TikTok profile persistence: concurrent ownership claims, client-scoped lists, foreign-ID rejection, stable retries and interrupted-index recovery passed.');
