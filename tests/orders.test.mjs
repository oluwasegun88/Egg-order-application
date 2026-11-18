import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle,validateOrder,validateAdminUpdate,validatePrices,lagosDate} from '../worker/index.js';
const order={name:'Ada',phone:'08028091950',email:'ada@example.com',method:'pickup',address:'',notes:'',preferred_date:lagosDate(2),items:[{id:'crate',quantity:2}]};
const post=(path,body,headers={})=>new Request('https://store.test'+path,{method:'POST',headers:{Origin:'https://store.test',...headers},body:body&&JSON.stringify(body)});
const adminReq=(method,path,body)=>new Request('https://store.test'+path,{method,headers:{Origin:'https://store.test','oai-authenticated-user-email':'owner@example.com'},body:JSON.stringify(body)});
// Minimal D1 stand-in that records every statement and returns canned rows.
function fakeDB({first=null,changes=1}={}){const calls=[];return {calls,prepare:sql=>({bind:(...values)=>({run:async()=>{calls.push({sql,values});return {meta:{changes:typeof changes==='function'?changes(sql):changes}};},first:async()=>typeof first==='function'?first(sql):first}),all:async()=>({results:[]})})};}

test('validates orders and ignores customer-supplied totals',()=>{assert.equal(validateOrder({...order,amount:1}).amount,undefined);assert.equal(validateOrder(order).items[0].quantity,2);});
test('rejects missing delivery address, duplicate products and invalid quantities',()=>{for(const b of [{...order,method:'delivery'},{...order,items:[...order.items,...order.items]},{...order,items:[{id:'crate',quantity:-1}]},{...order,email:'bad'}])assert.throws(()=>validateOrder(b));});
test('requires a real pickup/delivery date between today and 90 days ahead',()=>{
 assert.equal(validateOrder({...order,preferred_date:lagosDate(0)}).preferred_date,lagosDate(0));
 assert.equal(validateOrder({...order,preferred_date:lagosDate(90)}).preferred_date,lagosDate(90));
 for(const preferred_date of [undefined,'',lagosDate(-1),lagosDate(91),'2026-02-30','tomorrow'])assert.throws(()=>validateOrder({...order,preferred_date}),/date/);
});
test('admin requests require the configured signed-in administrator',async()=>{const r=await handle(new Request('https://store.test/api/admin/orders'),{DB:{},ADMIN_EMAIL:'owner@example.com'});assert.equal(r.status,403);});
test('cross-origin order writes are rejected',async()=>{const r=await handle(new Request('https://store.test/api/orders',{method:'POST',headers:{Origin:'https://other.test'},body:JSON.stringify(order)}),{DB:{}});assert.equal(r.status,403);});
test('orders are persisted with server-generated private tokens and the chosen date',async()=>{const DB=fakeDB();const r=await handle(post('/api/orders',order),{DB});assert.equal(r.status,201);const result=await r.json();const saved=DB.calls[0].values;assert.equal(saved[0],result.id);assert.equal(saved[1],result.token);assert.equal(saved[9],JSON.stringify(order.items));assert.equal(saved[10],order.preferred_date);});
test('a payment with the wrong amount is never marked paid',async()=>{const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json({status:true,data:{status:'success',reference:'ref',amount:1,currency:'NGN'}});try{const DB=fakeDB({first:{id:'a',payment_reference:'ref',amount:50000,payment_status:'unpaid'}});const r=await handle(post('/api/orders/a/verify',null,{'X-Order-Token':'private'}),{DB,PAYSTACK_SECRET_KEY:'test'});assert.deepEqual(await r.json(),{paid:false});assert.equal(DB.calls.length,0);}finally{globalThis.fetch=previous;}});
test('customers never see the private token or admin notes',async()=>{const DB=fakeDB({first:{id:'a',token:'secret',admin_notes:'owes from last week',items:'[]'}});const r=await handle(new Request('https://store.test/api/orders/a',{headers:{'X-Order-Token':'secret'}}),{DB});const b=await r.json();assert.equal(b.token,undefined);assert.equal(b.admin_notes,undefined);});
test('admin can record cash or transfer payments and private notes',async()=>{
 const DB=fakeDB();const r=await handle(adminReq('PATCH','/api/admin/orders',{id:'a',status:'confirmed',amount:360000,admin_notes:' regular ',payment:'transfer'}),{DB,ADMIN_EMAIL:'owner@example.com'});
 assert.equal(r.status,200);
 assert.ok(DB.calls.some(c=>/admin_notes=/.test(c.sql)&&c.values[0]==='regular'));
 const paid=DB.calls.find(c=>/payment_status='paid'/.test(c.sql));assert.deepEqual(paid.values,['transfer','a']);assert.match(paid.sql,/payment_status='unpaid'$/);
});
test('only manual payments can be undone',async()=>{const DB=fakeDB({changes:sql=>/payment_method IN/.test(sql)?0:1});const r=await handle(adminReq('PATCH','/api/admin/orders',{id:'a',status:'completed',amount:5000,payment:'unpaid'}),{DB,ADMIN_EMAIL:'owner@example.com'});assert.equal(r.status,409);});
test('admin updates reject bad payment options and notes',()=>{const base={id:'a',status:'new',amount:null};assert.throws(()=>validateAdminUpdate({...base,payment:'online'}));assert.throws(()=>validateAdminUpdate({...base,admin_notes:'x'.repeat(1001)}));assert.doesNotThrow(()=>validateAdminUpdate({...base,admin_notes:'ok',payment:'cash'}));});
test('price list accepts blanks and rejects bad values',()=>{assert.deepEqual(validatePrices({egg:15000,crate:null}),{egg:15000,half:null,crate:null});for(const b of [{egg:-1},{egg:1.5},{crate:'100'},null])assert.throws(()=>validatePrices(b));});
test('saving prices requires the administrator',async()=>{const r=await handle(new Request('https://store.test/api/admin/prices',{method:'PUT',headers:{Origin:'https://store.test'},body:'{}'}),{DB:fakeDB(),ADMIN_EMAIL:'owner@example.com'});assert.equal(r.status,403);});
