import {createClient} from '@supabase/supabase-js';
import {paymentFeeEvidence,resolveClientFee} from '../lib/business-simulator/client-fee.ts';
import {normalizeFeePercent} from '../lib/payments/deposit-fee.ts';
const options={auth:{persistSession:false,autoRefreshToken:false}};
const h=createClient(process.env.HECOM_SUPABASE_URL||process.env.PUBLIC_SUPABASE_URL||'https://fsnolvozwcnbyuradiru.supabase.co',process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY,options);
const c=await h.from('clientes').select('id,tiktok_default_fee').ilike('name','Alex Barra').limit(2);if(c.error)throw Error(c.error.message);if(c.data.length!==1)throw Error('Selected screenshot client not found uniquely');const client=c.data[0];
const accounts=await h.from('cliente_tiktok_cuentas').select('fee').eq('client_id',client.id);if(accounts.error)throw Error(accounts.error.message);
if(!process.env.SUPABASE_SERVICE_ROLE_KEY){console.log(JSON.stringify({screenshotClientFound:true,configuredFee:normalizeFeePercent(client.tiktok_default_fee),accountFees:accounts.data.map(a=>normalizeFeePercent(a.fee)),historyLiveCheck:'unavailable: production payment credential is protected',readOnly:true}));process.exit(0);}
const a=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
const payments=await a.from('payment_intents').select('id,organization_id,amount_cents,currency,provider,status,succeeded_at,metadata').eq('metadata->>hecom_cliente_id',client.id).eq('status','succeeded').gte('succeeded_at',new Date(Date.now()-180*86400000).toISOString()).order('succeeded_at',{ascending:false}).limit(100);if(payments.error)throw Error(payments.error.message);
const journals=payments.data.length?await a.from('ledger_journals').select('source_id,organization_id,amount_cents,currency,status').eq('source_table','payment_intents').eq('journal_type','deposit_confirmed').in('source_id',payments.data.map(p=>p.id)).limit(201):{data:[]};if(journals.error)throw Error(journals.error.message);
const result=resolveClientFee(normalizeFeePercent(client.tiktok_default_fee),accounts.data.map(a=>normalizeFeePercent(a.fee)),payments.data.map(p=>paymentFeeEvidence(p,journals.data)));
console.log(JSON.stringify({screenshotClientFound:true,fee:result.feeHolisticPercent,source:result.feeSource,confirmedPayments:payments.data.length,verifiedPayments:result.verifiedPayments,warnings:result.warnings,readOnly:true}));
