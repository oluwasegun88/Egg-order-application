'use strict';
const $=id=>document.getElementById(id);
const make=(tag,props={},...children)=>{const n=Object.assign(document.createElement(tag),props);n.append(...children);return n;};
const ACTIVE=['new','confirmed','ready'];
let orders=[],prices={};
for(const [value,label] of Object.entries(EGG.statusLabels))$('filter').append(make('option',{value,textContent:label}));

async function request(path,method='GET',data){
 const r=await fetch(path,{method,...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
 const b=await r.json();if(!r.ok)throw Error(b.error);return b;
}
async function load(){
 try{
  [orders,prices]=await Promise.all([request('/api/admin/orders'),request('/api/prices')]);
  $('message').textContent=orders.length+' orders loaded'+(orders.length>=500?' (showing the latest 500).':'.');
  renderPlan();renderPrices();render();
 }catch(e){$('message').textContent=e.message;}
}

// Customer phone → WhatsApp number (Nigerian numbers starting with 0 become 234…).
function whatsappNumber(phone){
 let d=phone.replace(/\D/g,'');
 if(d.startsWith('0')&&d.length===11)d='234'+d.slice(1);
 else if(d.length===10&&!d.startsWith('234'))d='234'+d;
 return d.length>=11?d:null;
}
function whatsappMessage(o){
 const items=EGG.itemsText(JSON.parse(o.items)),link=EGG.orderLink(o.id,o.token),when=o.preferred_date?' for '+EGG.dateText(o.preferred_date):'';
 const hi='Hello '+o.name+', this is Olaoyin Store about your egg order '+EGG.shortRef(o.id)+' ('+items+when+').';
 if(o.status==='cancelled')return hi+' Unfortunately we have had to cancel this order. Please reply if you have any questions.';
 if(o.status==='completed')return hi+' Thank you for buying from us! We hope to see you again.';
 if(o.status==='ready')return hi+(o.method==='delivery'?' Your eggs are ready and will be delivered soon.':' Your eggs are ready for pickup.')+(o.payment_status==='paid'?'':o.amount?' Amount due: '+EGG.naira(o.amount)+'.':'')+' Order details: '+link;
 if(o.status==='confirmed'&&o.amount&&o.payment_status!=='paid')return hi+' Your total is '+EGG.naira(o.amount)+(o.method==='delivery'?' including delivery':'')+'. You can view and pay here: '+link;
 if(o.payment_status==='paid')return hi+' We have received your payment, thank you. Track your order here: '+link;
 return hi+' We have received your order and will confirm the price shortly. Track it here: '+link;
}

function renderPlan(){
 const groups=new Map();
 for(const o of orders.filter(o=>ACTIVE.includes(o.status))){
  const key=o.preferred_date||'';if(!groups.has(key))groups.set(key,{orders:0,pickup:0,delivery:0,egg:0,half:0,crate:0,eggs:0});
  const g=groups.get(key),items=JSON.parse(o.items);g.orders++;g[o.method]++;g.eggs+=EGG.eggCount(items);for(const p of items)g[p.id]+=p.quantity;
 }
 if(!groups.size){$('plan').replaceChildren(make('p',{className:'muted',textContent:'No open orders.'}));return;}
 const today=EGG.lagosDate(0),keys=[...groups.keys()].sort((a,b)=>(a||'9999')<(b||'9999')?-1:1);
 const head=make('tr',{},...['Date','Orders','Full crates','Half crates','Single eggs','Total eggs','Pickup / delivery'].map(t=>make('th',{textContent:t})));
 const rows=keys.map(k=>{const g=groups.get(k);const tr=make('tr',{},...[EGG.dateText(k)+(k===today?' (today)':''),g.orders,g.crate,g.half,g.egg,g.eggs,g.pickup+' / '+g.delivery].map(t=>make('td',{textContent:String(t)})));if(k&&k<today)tr.className='overdue';return tr;});
 $('plan').replaceChildren(make('table',{className:'table'},make('thead',{},head),make('tbody',{},...rows)));
}

function renderPrices(){
 const inputs=EGG.products.map(p=>{const input=make('input',{type:'number',min:'1',max:'1000000',step:'0.01',name:p.id,value:prices[p.id]?prices[p.id]/100:'',placeholder:'Not shown'});return make('label',{},'₦ per '+p.unit,input);});
 const save=make('button',{type:'submit',textContent:'Save prices'});
 $('prices').replaceChildren(...inputs,save);
 $('prices').onsubmit=async e=>{e.preventDefault();if(!$('prices').reportValidity())return;save.disabled=true;
  try{const data={};for(const p of EGG.products){const v=$('prices').elements[p.id].value;data[p.id]=v?Math.round(Number(v)*100):null;}prices=await request('/api/admin/prices','PUT',data);$('message').textContent='Prices saved.';renderPrices();render();}
  catch(err){$('message').textContent=err.message;}finally{save.disabled=false;}};
}

function card(o){
 const items=JSON.parse(o.items),estimate=EGG.estimate(items,prices),manual=['cash','transfer'].includes(o.payment_method),paid=o.payment_status==='paid';
 const head=make('div',{className:'head'},make('span',{className:'name',textContent:o.name}),make('span',{className:'badge s-'+o.status,textContent:EGG.statusLabels[o.status]||o.status}));
 const info=[
  'Ref '+EGG.shortRef(o.id)+' · ordered '+new Date(o.created_at).toLocaleString('en-NG'),
  o.phone+' · '+o.email,
  EGG.itemsText(items)+' ('+EGG.eggCount(items)+' eggs)',
  (o.method==='delivery'?'Delivery':'Pickup')+' · '+EGG.dateText(o.preferred_date)+(o.address?' · '+o.address:'')
 ].map(t=>make('p',{textContent:t}));
 if(o.notes)info.push(make('p',{className:'muted',textContent:'Customer notes: '+o.notes}));
 info.push(make('p',{className:paid?'paid':'unpaid',textContent:EGG.paymentText(o)+(o.amount!==null?' · Total '+EGG.naira(o.amount):'')}));

 const status=make('select',{},...Object.entries(EGG.statusLabels).map(([value,label])=>make('option',{value,textContent:label})));status.value=o.status;
 const locked=Boolean(o.payment_reference)||paid;
 const amount=make('input',{type:'number',min:'50',max:'1000000',step:'0.01',value:o.amount===null?'':o.amount/100,disabled:locked,placeholder:estimate?'Estimate '+(estimate/100):''});
 const amountLabel=make('label',{},'Total incl. delivery (₦)',amount);
 if(estimate&&!locked&&o.amount===null){const use=make('button',{type:'button',className:'secondary',textContent:'Use estimate '+EGG.naira(estimate)});use.onclick=()=>{amount.value=estimate/100;};amountLabel.append(use);}
 const payment=make('select');
 if(paid&&!manual)payment.append(make('option',{value:'',textContent:'Paid online (Paystack)'})),payment.disabled=true;
 else if(paid)payment.append(make('option',{value:'',textContent:EGG.paymentText(o)}),make('option',{value:'unpaid',textContent:'Undo: mark as not paid'}));
 else payment.append(make('option',{value:'',textContent:'Not paid'}),make('option',{value:'cash',textContent:'Mark paid by cash'}),make('option',{value:'transfer',textContent:'Mark paid by bank transfer'}));
 const notes=make('textarea',{maxLength:1000,value:o.admin_notes||'',placeholder:'Only you can see this'});
 const controls=make('div',{className:'controls'},make('label',{},'Status',status),amountLabel,make('label',{},'Payment',payment),make('label',{},'Private notes',notes));

 const save=make('button',{textContent:'Save changes'});
 save.onclick=async()=>{
  try{
   if(amount.value&&!amount.checkValidity())throw Error('Enter a valid total between ₦50 and ₦1,000,000.');
   const total=locked?o.amount:amount.value?Math.round(Number(amount.value)*100):null;
   if(status.value==='confirmed'&&total===null)throw Error('Set the total for '+o.name+'’s order before confirming it.');
   if(['cash','transfer'].includes(payment.value)&&o.payment_reference&&!confirm('An online payment was started for this order. Check Paystack first so the customer is not charged twice. Mark as paid anyway?'))return;
   if(payment.value==='unpaid'&&!confirm('Mark this order as not paid?'))return;
   save.disabled=true;
   await request('/api/admin/orders','PATCH',{id:o.id,status:status.value,amount:total,admin_notes:notes.value,...(payment.value?{payment:payment.value}:{})});
   $('message').textContent='Saved '+o.name+'’s order. Use “Send update on WhatsApp” to let them know.';await load();
  }catch(e){$('message').textContent=e.message;}finally{save.disabled=false;}
 };
 const number=whatsappNumber(o.phone);
 const wa=make('a',{className:'btn',textContent:'Send update on WhatsApp',target:'_blank',rel:'noopener',href:number?'https://wa.me/'+number+'?text='+encodeURIComponent(whatsappMessage(o)):'#'});
 if(!number){wa.setAttribute('aria-disabled','true');wa.title='Phone number not recognised';}
 const link=make('a',{textContent:'Open customer’s order page',href:'/order.html#'+o.id+':'+o.token,target:'_blank',rel:'noopener'});
 return make('article',{},head,...info,controls,make('div',{className:'actions'},save,wa,link));
}

function render(){
 const q=$('search').value.trim().toLowerCase(),f=$('filter').value;
 let list=orders.filter(o=>(!f||(f==='active'?ACTIVE.includes(o.status):o.status===f))&&(!q||[o.name,o.phone,o.email,EGG.shortRef(o.id)].some(v=>v.toLowerCase().includes(q))||o.phone.replace(/\D/g,'').includes(q.replace(/\D/g,'')||'\u0000')));
 if($('sort').value==='date')list=[...list].sort((a,b)=>(a.preferred_date||'9999')<(b.preferred_date||'9999')?-1:1);
 $('orders').replaceChildren(...(list.length?list.map(card):[make('p',{className:'muted',textContent:'No orders match.'})]));
}
$('search').oninput=render;$('filter').onchange=render;$('sort').onchange=render;$('refresh').onclick=load;
load();
