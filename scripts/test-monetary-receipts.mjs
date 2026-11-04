import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(file,imports={}){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console,Map,Set,Date,Number,Error})(id=>imports[id]??{},m,m.exports);return m.exports}
const amounts=load('lib/hecom/payment-applicable-amount.ts');
const dashboard=load('lib/hecom/cliente-dashboard.server.ts',{'react':{cache:f=>f},'@/lib/hecom/payment-applicable-amount':amounts});
const rows=[{id:'real',client_id:'qa',monto:50,metodo:'BCP',notas:'Ajuste de referencia del pago real'}, {id:'adjustment',monto:20,metodo:'Ajuste'}, {id:'code',monto:30,codigo:'AJ-TEST'}, {id:'flag',monto:40,funding_breakdown:{excluded_non_cash_adjustment:true}}];
const before=JSON.stringify(rows),out=dashboard.mapMonetaryCobros(rows);
assert.equal(out.length,1);assert.equal(out[0].id,'real');assert.equal(out[0].monto,50);assert.equal(out[0].applicableMonto,50);assert.equal(JSON.stringify(rows),before);
assert.equal(amounts.isNonCashAdjustment({metodo:'Condonación'}),true);
console.log('Live/backup monetary receipt projection: adjustments excluded from count, recent payments and original amounts; real bank payments preserved.');
