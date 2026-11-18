'use strict';
// Shared helpers used by the shop, order and admin pages.
const EGG={
 products:[{id:'egg',name:'Single eggs',unit:'egg',eggs:1},{id:'half',name:'Half crate',unit:'half crate',eggs:15},{id:'crate',name:'Full crate',unit:'crate',eggs:30}],
 product:id=>EGG.products.find(p=>p.id===id)||{id,name:id,unit:id,eggs:0},
 naira:kobo=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(kobo/100),
 itemsText:items=>items.map(p=>p.quantity+' × '+EGG.product(p.id).name).join(', '),
 eggCount:items=>items.reduce((n,p)=>n+EGG.product(p.id).eggs*p.quantity,0),
 // Estimated total in kobo, or null when any chosen product has no price set.
 estimate:(items,prices)=>items.length&&items.every(p=>prices[p.id])?items.reduce((n,p)=>n+prices[p.id]*p.quantity,0):null,
 lagosDate:(days=0)=>new Date(Date.now()+3600e3+days*864e5).toISOString().slice(0,10),
 dateText:d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'No date given',
 shortRef:id=>String(id).slice(0,8).toUpperCase(),
 statusLabels:{new:'Awaiting confirmation',confirmed:'Confirmed',ready:'Ready',completed:'Completed',cancelled:'Cancelled'},
 paymentText:o=>o.payment_status!=='paid'?'Not paid yet':({online:'Paid online',cash:'Paid by cash',transfer:'Paid by bank transfer'}[o.payment_method]||'Paid'),
 orderLink:(id,token)=>location.origin+'/order.html#'+id+':'+token
};
