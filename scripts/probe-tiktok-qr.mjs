import { writeFile } from 'node:fs/promises';
const token = process.env.TIKTOK_ACCESS_TOKEN;
if (!token) throw new Error('Falta TIKTOK_ACCESS_TOKEN.');
const base = 'https://business-api.tiktok.com/open_api/v1.3';
const reports = [];
for (const [bm, bc_id] of Object.entries({10:'7652451146933698576',30:'7564426417577148433',200:'7575005779271614480',300:'7680955666005196801'})) {
  for (const [path, method, params] of [
    ['/bc/asset/admin/get/','GET',{bc_id,asset_type:'TT_ACCOUNT',page:1,page_size:1}],
    ['/bc/asset/account/authorization/','POST',{bc_id,is_ads_only_mode:true}],
    // Missing required IDs intentionally: never creates or changes a linkage.
    ['/bc/asset/advertiser/assign/','POST',{bc_id}],
  ]) {
    const url = new URL(base + path);
    if (method === 'GET') Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
    const response = await fetch(url,{method,headers:{'Access-Token':token,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(params)}:{}),signal:AbortSignal.timeout(20000)});
    const data = await response.json();
    reports.push({bm,endpoint:path,http:response.status,code:data.code,message:data.message,requestId:data.request_id,qrReturned:Boolean(data.data?.bc_auth_qr_code)});
    if (method === 'GET' && data.code === 0 && data.data?.list?.[0]?.asset_id) {
      const assetId = data.data.list[0].asset_id;
      const assignedUrl = new URL(base+'/bc/asset/advertiser/assigned/');
      Object.entries({bc_id,asset_type:'TT_ACCOUNT',asset_id:assetId,page:1,page_size:1}).forEach(([k,v])=>assignedUrl.searchParams.set(k,String(v)));
      const assigned = await (await fetch(assignedUrl,{headers:{'Access-Token':token}})).json();
      reports.push({bm,endpoint:'/bc/asset/advertiser/assigned/',code:assigned.code,message:assigned.message,requestId:assigned.request_id});
      let advertiserId = assigned.data?.list?.[0]?.advertiser_id;
      if (!advertiserId) {
        const adsUrl = new URL(base+'/bc/asset/admin/get/');
        Object.entries({bc_id,asset_type:'ADVERTISER',page:1,page_size:1}).forEach(([k,v])=>adsUrl.searchParams.set(k,String(v)));
        const ads = await (await fetch(adsUrl,{headers:{'Access-Token':token}})).json();
        advertiserId = ads.data?.list?.[0]?.asset_id;
      }
      if (advertiserId) {
        const identitiesUrl = new URL(base+'/identity/get/');
        Object.entries({advertiser_id:advertiserId,identity_type:'BC_AUTH_TT',identity_authorized_bc_id:bc_id,page:1,page_size:100}).forEach(([k,v])=>identitiesUrl.searchParams.set(k,String(v)));
        const identityList = await (await fetch(identitiesUrl,{headers:{'Access-Token':token}})).json();
        reports.push({bm,endpoint:'/identity/get/',code:identityList.code,message:identityList.message,count:identityList.data?.identity_list?.length,assetIdMatchesIdentity:identityList.data?.identity_list?.some(row=>row.identity_id===assetId),requestId:identityList.request_id});
        const infoUrl = new URL(base+'/identity/info/');
        Object.entries({advertiser_id:advertiserId,identity_id:assetId,identity_type:'BC_AUTH_TT',identity_authorized_bc_id:bc_id}).forEach(([k,v])=>infoUrl.searchParams.set(k,v));
        const info = await (await fetch(infoUrl,{headers:{'Access-Token':token}})).json();
        reports.push({bm,endpoint:'/identity/info/',code:info.code,message:info.message,usernameReturned:Boolean(info.data?.identity_info?.username),requestId:info.request_id});
      }
    }
  }
}
await writeFile('output/tiktok-qr-permissions.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
