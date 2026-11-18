const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const PRODUCTS=['egg','half','crate'];
export const STATUSES=['new','confirmed','ready','completed','cancelled'];
const MAX_DAYS_AHEAD=90;
// Calendar date in Lagos (UTC+1, no daylight saving), as YYYY-MM-DD.
export const lagosDate=(offsetDays=0,now=Date.now())=>new Date(now+3600e3+offsetDays*864e5).toISOString().slice(0,10);
export function validateOrder(b,now=Date.now()){
 const out={};
 for(const [key,max] of Object.entries({name:100,phone:30,email:254,address:500,notes:500,preferred_date:10})){
  if(typeof b[key]!=='string'||b[key].length>max)fail(key==='preferred_date'?'Choose a pickup or delivery date.':'Invalid '+key);
  out[key]=b[key].trim();
 }
 if(!out.name||!/^\+?[\d ()-]{7,30}$/.test(out.phone)||!/^\S+@\S+\.\S+$/.test(out.email))fail('Enter a valid name, phone number and email.');
 if(!['pickup','delivery'].includes(b.method)||b.method==='delivery'&&!out.address)fail('Provide delivery details.');
 out.method=b.method;
 const d=out.preferred_date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)fail('Choose a pickup or delivery date.');
 if(d<lagosDate(0,now)||d>lagosDate(MAX_DAYS_AHEAD,now))fail('Choose a date between today and '+MAX_DAYS_AHEAD+' days from now.');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>3)fail('Choose your eggs.');
 const ids=new Set();
 out.items=b.items.map(p=>{if(!PRODUCTS.includes(p.id)||ids.has(p.id)||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>999)fail('Invalid quantity');ids.add(p.id);return {id:p.id,quantity:p.quantity};});
 return out;
}
export function validateAdminUpdate(b){
 if(typeof b.id!=='string'||!b.id)fail('Order not found',404);
 if(!STATUSES.includes(b.status))fail('Invalid status');
 if(b.amount!==null&&(!Number.isSafeInteger(b.amount)||b.amount<5000||b.amount>100000000))fail('Enter a total between ₦50 and ₦1,000,000.');
 if(b.admin_notes!==undefined&&(typeof b.admin_notes!=='string'||b.admin_notes.length>1000))fail('Private notes must be under 1000 characters.');
 if(b.payment!==undefined&&!['cash','transfer','unpaid'].includes(b.payment))fail('Invalid payment option');
 return b;
}
export function validatePrices(b){
 if(!b||typeof b!=='object')fail('Invalid prices');
 const out={};
 for(const id of PRODUCTS){
  const v=b[id];
  if(v===null||v===undefined){out[id]=null;continue;}
  if(!Number.isSafeInteger(v)||v<100||v>100000000)fail('Enter prices between ₦1 and ₦1,000,000, or leave blank.');
  out[id]=v;
 }
 return out;
}
const admin=(r,e)=>Boolean(e.ADMIN_EMAIL&&r.headers.get('oai-authenticated-user-email')?.toLowerCase()===e.ADMIN_EMAIL.toLowerCase());
async function body(r){if(Number(r.headers.get('content-length'))>8192)fail('Request too large',413);const raw=await r.text();if(raw.length>8192)fail('Request too large',413);try{return JSON.parse(raw);}catch{fail('Invalid JSON');}}
async function paystack(env,path,data){
 if(!env.PAYSTACK_SECRET_KEY)fail('Online payment is not configured yet. Please contact the store.',503);
 const res=await fetch('https://api.paystack.co/transaction/'+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 const result=await res.json();if(!res.ok||!result.status)fail('Payment provider is unavailable. Please try again.',502);return result.data;
}
async function priceList(env){
 const rows=(await env.DB.prepare('SELECT id,amount FROM prices').all()).results||[];
 return Object.fromEntries(rows.filter(r=>PRODUCTS.includes(r.id)).map(r=>[r.id,r.amount]));
}
export async function handle(request,env){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)fail('Invalid origin',403);
  if(path.startsWith('/api/')){
   if(!env.DB)fail('Order storage is not configured.',503);
   if(path==='/api/prices'&&request.method==='GET')return json(await priceList(env));
   if(path==='/api/orders'&&request.method==='POST'){
    const b=validateOrder(await body(request));const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
    await env.DB.prepare('INSERT INTO orders(id,token,created_at,name,phone,email,method,address,notes,items,preferred_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,token,new Date().toISOString(),b.name,b.phone,b.email,b.method,b.address,b.notes,JSON.stringify(b.items),b.preferred_date).run();
    return json({id,token},201);
   }
   if(path.startsWith('/api/admin')){
    if(!admin(request,env))fail('Sign in with the store administrator account.',403);
    if(path==='/api/admin/orders'&&request.method==='GET')return json((await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500').all()).results);
    if(path==='/api/admin/prices'&&request.method==='PUT'){
     const prices=validatePrices(await body(request));
     for(const [id,amount] of Object.entries(prices)){
      if(amount===null)await env.DB.prepare('DELETE FROM prices WHERE id=?').bind(id).run();
      else await env.DB.prepare('INSERT INTO prices(id,amount) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET amount=excluded.amount').bind(id,amount).run();
     }
     return json(await priceList(env));
    }
    if(path==='/api/admin/orders'&&request.method==='PATCH'){
     const b=validateAdminUpdate(await body(request));
     const result=await env.DB.prepare("UPDATE orders SET status=?,amount=? WHERE id=? AND payment_status='unpaid' AND payment_reference IS NULL").bind(b.status,b.amount,b.id).run();
     if(!result.meta.changes){const existing=await env.DB.prepare('SELECT amount FROM orders WHERE id=?').bind(b.id).first();if(!existing)fail('Order not found',404);if(existing.amount!==b.amount)fail('A payment has started or been recorded; its total cannot be changed.',409);await env.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(b.status,b.id).run();}
     if(b.admin_notes!==undefined)await env.DB.prepare('UPDATE orders SET admin_notes=? WHERE id=?').bind(b.admin_notes.trim(),b.id).run();
     if(b.payment==='cash'||b.payment==='transfer')await env.DB.prepare("UPDATE orders SET payment_status='paid',payment_method=? WHERE id=? AND payment_status='unpaid'").bind(b.payment,b.id).run();
     if(b.payment==='unpaid'){
      // Only manually recorded payments can be undone; online payments are verified with Paystack.
      const undo=await env.DB.prepare("UPDATE orders SET payment_status='unpaid',payment_method=NULL WHERE id=? AND payment_method IN ('cash','transfer')").bind(b.id).run();
      if(!undo.meta.changes)fail('Only cash or transfer payments can be marked unpaid.',409);
     }
     return json({ok:true});
    }
   }
   const match=path.match(/^\/api\/orders\/([a-f0-9-]+)(?:\/(pay|verify))?$/);
   if(match){
    const token=request.headers.get('X-Order-Token');if(!token)fail('Order access required',403);
    const order=await env.DB.prepare('SELECT * FROM orders WHERE id=? AND token=?').bind(match[1],token).first();if(!order)fail('Order not found',404);
    if(!match[2]&&request.method==='GET'){delete order.token;delete order.admin_notes;return json({...order,payments_enabled:Boolean(env.PAYSTACK_SECRET_KEY)});}
    if(match[2]==='pay'&&request.method==='POST'){
     if(order.status!=='confirmed'||!order.amount||order.payment_status==='paid')fail('This order is not awaiting payment.',409);
     if(!env.PAYSTACK_SECRET_KEY)fail('Online payment is not configured yet.',503);
     if(order.checkout_url)return json({url:order.checkout_url});
     const reference='egg-'+crypto.randomUUID();
     await env.DB.prepare('UPDATE orders SET payment_reference=COALESCE(payment_reference,?) WHERE id=?').bind(reference,order.id).run();
     const current=await env.DB.prepare('SELECT payment_reference FROM orders WHERE id=?').bind(order.id).first();
     // Reuse an existing checkout after a retry, without creating a second charge.
     if(current.payment_reference!==reference){const previous=await paystack(env,'verify/'+encodeURIComponent(current.payment_reference));if(previous.status==='success')return json({verify:true});fail('A payment attempt already exists. Use Check payment or contact the store before retrying.',409);}
     const result=await paystack(env,'initialize',{email:order.email,amount:order.amount,currency:'NGN',reference,callback_url:url.origin+'/order.html#'+order.id+':'+token});
     await env.DB.prepare('UPDATE orders SET checkout_url=? WHERE id=? AND payment_reference=?').bind(result.authorization_url,order.id,reference).run();
     return json({url:result.authorization_url});
    }
    if(match[2]==='verify'&&request.method==='POST'){
     if(!order.payment_reference)fail('No payment has started.');
     if(order.payment_status==='paid')return json({paid:true});
     const payment=await paystack(env,'verify/'+encodeURIComponent(order.payment_reference));
     if(payment.status==='success'&&payment.reference===order.payment_reference&&payment.amount===order.amount&&payment.currency==='NGN'){
      await env.DB.prepare("UPDATE orders SET payment_status='paid',payment_method='online' WHERE id=?").bind(order.id).run();return json({paid:true});
     }return json({paid:false});
    }
   }
   fail('Not found',404);
  }
  const file=path==='/'?'/index.html':path;
  if(!Object.hasOwn(assets,file))return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:assets[file],{headers:{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'"}});
 }catch(error){if(!error.status)console.error('Order API failed',error.message);return json({error:error.status?error.message:'Something went wrong. Please try again.'},error.status||500);}
}
export default {fetch:handle};
