// Save the order before taking the customer to its private status page.
el('order').onsubmit=async event=>{
 event.preventDefault();if(!chosen().length||!el('order').reportValidity())return;
 const button=el('checkout');button.disabled=true;
 try{const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:el('name').value,phone:el('phone').value,email:el('email').value,method:el('method').value,address:el('address').value,notes:el('notes').value,items:chosen().map(p=>({id:p.id,quantity:quantities[p.id]}))})});const result=await response.json();if(!response.ok)throw Error(result.error);location.assign('/order.html#'+result.id+':'+result.token);}catch(error){el('status').textContent=error.message||'Could not save your order. Please try again.';}finally{button.disabled=false;}
};
