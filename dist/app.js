'use strict';
const products=EGG.products;
const quantities=Object.fromEntries(products.map(p=>[p.id,0]));
let prices={};
const el=id=>document.getElementById(id);
const chosen=()=>products.filter(p=>quantities[p.id]>0);
const chosenItems=()=>chosen().map(p=>({id:p.id,quantity:quantities[p.id]}));
function render(){
 const summary=el('summary');summary.replaceChildren();const items=chosenItems();
 if(!items.length){summary.textContent='Choose a quantity to get started.';}
 else{
  for(const p of items){const row=document.createElement('div');row.textContent=p.quantity+' × '+EGG.product(p.id).name+(prices[p.id]?' — '+EGG.naira(prices[p.id]*p.quantity):'');summary.append(row);}
  const count=document.createElement('div');count.textContent='Total eggs: '+EGG.eggCount(items);summary.append(count);
  const total=document.createElement('strong');const estimate=EGG.estimate(items,prices);
  total.textContent=estimate?'Estimated total: '+EGG.naira(estimate)+' (before delivery)':'Price: confirmed before you pay';summary.append(total);
 }
 el('checkout').disabled=!items.length;
}
function showPrices(){
 for(const p of products)el('price-'+p.id).textContent=prices[p.id]?EGG.naira(prices[p.id])+' per '+p.unit:'';
 if(Object.keys(prices).length)el('pricing').textContent='Prices shown are today’s estimates. We’ll confirm your final total, including any delivery charge, before you pay.';
}
for(const p of products){
 const card=document.createElement('div');card.className='product';
 const icon=document.createElement('span');icon.className='icon';icon.textContent='🥚';icon.setAttribute('aria-hidden','true');
 const info=document.createElement('div');info.className='info';
 const title=document.createElement('h3');title.textContent=p.name;
 const detail=document.createElement('p');detail.textContent=p.eggs===1?'Choose the number of eggs':p.eggs+' eggs per '+p.unit;
 const price=document.createElement('p');price.className='price';price.id='price-'+p.id;
 info.append(title,detail,price);
 const controls=document.createElement('div');controls.className='counter';
 const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.setAttribute('aria-label','Remove '+p.name);
 const count=document.createElement('span');count.textContent='0';count.setAttribute('aria-live','polite');
 const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.setAttribute('aria-label','Add '+p.name);
 function change(delta){quantities[p.id]=Math.max(0,Math.min(999,quantities[p.id]+delta));count.textContent=quantities[p.id];minus.disabled=quantities[p.id]===0;plus.disabled=quantities[p.id]===999;render();}
 minus.onclick=()=>change(-1);plus.onclick=()=>change(1);minus.disabled=true;
 controls.append(minus,count,plus);card.append(icon,info,controls);el('products').append(card);
}
el('date').min=EGG.lagosDate(0);el('date').max=EGG.lagosDate(90);
el('method').onchange=()=>{const delivery=el('method').value==='delivery';el('addressWrap').hidden=!delivery;el('address').required=delivery;el('dateLabel').textContent=delivery?'Preferred delivery date':'Preferred pickup date';};
// Save the order, then take the customer to its private status page.
el('order').onsubmit=async event=>{
 event.preventDefault();if(!chosen().length||!el('order').reportValidity())return;
 const button=el('checkout');button.disabled=true;el('status').textContent='Saving your order…';
 try{
  const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:el('name').value,phone:el('phone').value,email:el('email').value,method:el('method').value,address:el('address').value,notes:el('notes').value,preferred_date:el('date').value,items:chosenItems()})});
  const result=await response.json();if(!response.ok)throw Error(result.error);
  location.assign('/order.html#'+result.id+':'+result.token);
 }catch(error){el('status').textContent=error.message||'Could not save your order. Please try again.';button.disabled=false;}
};
fetch('/api/prices').then(r=>r.ok?r.json():{}).then(p=>{prices=p||{};showPrices();render();}).catch(()=>{});
render();
