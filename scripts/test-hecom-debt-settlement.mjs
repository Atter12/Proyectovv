import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const root=process.cwd();
const core=require(path.join(root,'lib/hecom/debt-core.cjs'));
export function loadTs(file,imports={}){
  const code=ts.transpileModule(readFileSync(path.join(root,file),'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console:{warn(){}},Map,Set,Number,Date,Error,Promise})(id=>{
    if(id in imports)return imports[id];throw Error('Unmocked dependency '+id);
  },module,module.exports);
  return module.exports;
}
const pure=loadTs('lib/hecom/debt-settlement.ts',{'./debt-core.cjs':core});
const CID='11111111-1111-4111-8111-111111111111';
const expense=(id,mes,gasto)=>({id,client_id:CID,mes,gasto,fee:0});
const receipt=(monto,periodo_resumen,extra={})=>({id:'payment',client_id:CID,monto,fecha:periodo_resumen+'-05',periodo_resumen,...extra});
const gs=[expense('old','2026-04',700),expense('new','2026-10',400)];
const ps=[receipt(1000,'2026-04')];
const before=JSON.stringify(ps);
assert.equal(pure.calculateMonthlyDebtSettlement(CID,gs,ps,[])['2026-10'].pending,400);
assert.equal(JSON.stringify(ps),before,'No original payment changes');
assert.equal(pure.calculateMonthlyDebtSettlement(CID,gs,[receipt(700,'2026-04')],[{client_id:CID,valor:100,estado:'Vigente',periodo_resumen:'2026-04'}])['2026-10'].pending,400);
assert.throws(()=>pure.calculateMonthlyDebtSettlement(CID,[{...gs[0],client_id:'foreign'}],ps,[]),/another customer/);
assert.throws(()=>pure.calculateMonthlyDebtSettlement(CID,gs,[{...ps[0],client_id:'foreign'}],[]),/another customer/);
assert.throws(()=>pure.calculateMonthlyDebtSettlement(CID,gs,ps,[{client_id:'foreign',valor:999999}]),/another customer/);

export function fakeDb(tables,{failTable=null,badCount=false}={}){
  const calls=[];
  return {calls,from(table){
    const filters=[];let legacy=false;
    const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){legacy=k==='client_id'&&v===null;return q;},order(){return q;},async range(from,to){
      assert.ok(filters.some(([k,v])=>['client_id','gastos.client_id'].includes(k)&&v===CID),'Every page must be customer scoped');
      calls.push({table,from,to,legacy});
      if(table===failTable)return {data:null,error:{message:'fixture failure'},count:null};
      const rows=legacy?[]:(tables[table]||[]);
      return {data:rows.slice(from,to+1),error:null,count:badCount?null:rows.length};
    }};return q;
  }};
}
export function settlementLoader(db){
  return loadTs('lib/hecom/debt-settlement.server.ts',{'server-only':{},react:{cache:fn=>fn},'@/lib/hecom/supabase.server':{createHecomAdminClient:()=>db},'@/lib/hecom/debt-settlement':pure}).getHecomMonthlyDebtSettlement;
}
const many=Array.from({length:1201},(_,i)=>expense('old-'+String(i).padStart(5,'0'),'2026-09',1));
many.push(expense('oct','2026-10',400));
const db=fakeDb({gastos:many,cobros:[receipt(1501,'2026-09')],garantias:[]});
const result=await settlementLoader(db)(CID);
assert.equal(result['2026-10'].pending,400,'Debt must include expenses beyond the first 1000');
assert.equal(db.calls.filter(c=>c.table==='gastos').length,3);
assert.equal(await settlementLoader(fakeDb({},{failTable:'garantias'}))(CID),null,'Unread guarantees cannot turn into a bill');
assert.equal(await settlementLoader(fakeDb({},{badCount:true}))(CID),null,'An incomplete count cannot turn into a bill');
const invalidDb=fakeDb({});assert.equal(await settlementLoader(invalidDb)('not-a-customer'),null);assert.equal(invalidDb.calls.length,0);

// The account statement must paginate, rather than silently accept the API row cap.
const dashboard=readFileSync(path.join(root,'lib/hecom/cliente-dashboard.server.ts'),'utf8');
const start=dashboard.indexOf('async function financeRows('),end=dashboard.indexOf('    const financeQueries',start);
assert.ok(start>0&&end>start);
const functionCode=ts.transpileModule(dashboard.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const statementDb=fakeDb({gastos:many});
const readFinance=new Function('hecom','full','clientId',functionCode+';return financeRows;')(statementDb,true,CID);
const statement=await readFinance('gastos','id,client_id,mes,gasto,fee',4000,'created_at');
assert.equal(statement.data.length,1202);assert.equal(statementDb.calls.length,3);
console.log('Settlement checks passed: historical payments, advances, customer isolation, complete pagination and unavailable-data handling.');

const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const translations=JSON.parse(readFileSync(path.join(root,'messages/es.json'),'utf8')).cobros.statement;
const statementModule=loadTs('features/clientes/components/VoucherAccountStatement.client.tsx',{
  react:React,'react/jsx-runtime':require('react/jsx-runtime'),
  'next-intl':{useLocale:()=> 'es',useTranslations:()=> (key,vars={})=>String(translations[key]??key).replace(/\{(\w+)\}/g,(_,k)=>String(vars[k]??k))},
  '@/lib/format/money-usd':loadTs('lib/format/money-usd.ts'),
  '@/lib/hecom/gasto-date':loadTs('lib/hecom/gasto-date.ts'),
  '@/lib/hecom/gasto-label':loadTs('lib/hecom/gasto-label.ts'),
});
const props={monthYm:'2026-10',feePercent:5,capped:false,
  gastos:[{fecha:'2026-10-31',gasto:11852.4,fee:5,camp:null}],
  cobros:[{fecha:'2026-10-12',monto:5000,metodo:'Binance',periodoResumen:'2026-10'}],
  pendingUsd:7445.02,
};
const markup=renderToStaticMarkup(React.createElement(statementModule.VoucherAccountStatement,props));
assert.ok(markup.includes('$7,445.02'),'The displayed balance uses the same canonical calculation as Hecom collection');
assert.ok(markup.includes('$5,000.00'),'The real monthly payment stays visible');
assert.ok(!markup.includes('Aplicado desde el historial:'),'Do not assign historical coverage automatically');
assert.ok(!markup.includes('$176.02'),'Do not expose a second conflicting debt formula');
console.log('Rendered balance checks passed: one canonical balance, original payment visible, no comparison panels.');
