'use strict';
const $=id=>document.getElementById(id);
// Paystack may append ?trxref=…&reference=… after the hash, so cut the token at the first ? or &.
const [id,rawToken='']=location.hash.slice(1).split(':');
const token=rawToken.split(/[?&]/)[0];
let autoChecked=false;
async function api(action='',method='GET'){const r=await fetch('/api/orders/'+encodeURIComponent(id)+(action?'/'+action:''),{method,headers:{'X-Order-Token':token}});const b=await r.json();if(!r.ok)throw Error(b.error);return b;}
function headline(o){
 const paid=o.payment_status==='paid';
 if(o.status==='cancelled')return 'This order was cancelled. Chat with us on WhatsApp if this is unexpected.';
 if(o.status==='completed')return 'Order complete. Thank you for buying from Olaoyin Store!';
 if(o.status==='ready')return o.method==='delivery'?'Your eggs are ready and on their way to you soon.':'Your eggs are ready for pickup!';
 if(o.status==='confirmed'&&paid)return 'Payment received. We’re getting your eggs ready.';
 if(o.status==='confirmed'&&o.amount)return 'Your total is confirmed: '+EGG.naira(o.amount)+'. '+(o.payments_enabled?'Pay online below, or pay as agreed with the store.':'Please pay as agreed with the store.');
 return 'Thanks! We’ve received your order and will confirm the price and availability shortly.';
}
function steps(o){
 const progressed=['confirmed','ready','completed'].includes(o.status);
 const list=[['Order placed',true],['Total confirmed',progressed&&Boolean(o.amount)||o.status==='ready'||o.status==='completed'],['Paid',o.payment_status==='paid'],['Ready',o.status==='ready'||o.status==='completed'],['Completed',o.status==='completed']];
 $('steps').replaceChildren();$('steps').hidden=o.status==='cancelled';
 for(const [label,done] of list){const li=document.createElement('li');li.textContent=label;if(done){li.className='done';li.setAttribute('aria-label',label+' (done)');}$('steps').append(li);}
}
function details(o){
 const items=JSON.parse(o.items);
 const rows=[['Order ref',EGG.shortRef(o.id)],['Name',o.name],['Eggs',EGG.itemsText(items)+' ('+EGG.eggCount(items)+' eggs)'],[o.method==='delivery'?'Delivery date':'Pickup date',EGG.dateText(o.preferred_date)],[o.method==='delivery'?'Deliver to':'Collection',o.method==='delivery'?o.address:'Pickup from the store'],['Status',EGG.statusLabels[o.status]||o.status],['Total',o.amount===null?'Awaiting confirmation':EGG.naira(o.amount)],['Payment',EGG.paymentText(o)]];
 if(o.notes)rows.push(['Your notes',o.notes]);
 $('details').replaceChildren();
 for(const [k,v] of rows){const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;$('details').append(dt,dd);}
 $('headline').classList.toggle('cancelled',o.status==='cancelled');
}
async function load(){
 try{
  const o=await api();
  // After returning from Paystack, confirm the payment automatically once.
  if(!autoChecked&&o.payment_reference&&o.payment_status!=='paid'&&o.payments_enabled){autoChecked=true;try{const v=await api('verify','POST');if(v.paid){$('message').textContent='Payment confirmed. Thank you!';return load();}}catch{}}
  autoChecked=true;
  $('headline').textContent=headline(o);steps(o);details(o);
  $('pay').hidden=!(o.status==='confirmed'&&o.amount&&o.payment_status!=='paid'&&o.payments_enabled);
  $('verify').hidden=!o.payment_reference||o.payment_status==='paid';
  $('whatsapp').hidden=false;$('whatsapp').href='https://wa.me/2348028091950?text='+encodeURIComponent('Hello Olaoyin Store, I have a question about my egg order '+EGG.shortRef(o.id)+'. My order link: '+EGG.orderLink(id,token));
 }catch(e){$('headline').textContent='We couldn’t load this order.';$('message').textContent=e.message+' Check that you opened the full link.';}
}
$('link').value=EGG.orderLink(id,token);
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('link').value);$('copy').textContent='Copied!';}catch{$('link').select();$('copy').textContent='Press Ctrl+C / long-press to copy';}setTimeout(()=>{$('copy').textContent='Copy link';},2500);};
$('refresh').onclick=load;
$('pay').onclick=async()=>{$('pay').disabled=true;try{const b=await api('pay','POST');if(b.verify){$('message').textContent='Payment found. Tap Check payment to confirm.';}else{location.assign(b.url);return;}}catch(e){$('message').textContent=e.message;}$('pay').disabled=false;await load();};
$('verify').onclick=async()=>{try{const b=await api('verify','POST');$('message').textContent=b.paid?'Payment confirmed. Thank you!':'Payment has not been confirmed yet. Please check again in a moment.';await load();}catch(e){$('message').textContent=e.message;}};
load();
