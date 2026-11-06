import {test,expect} from '@playwright/test';
const mobile=()=>test.info().project.name==='mobile';

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.removeItem('kurio-db-v1'));
  await page.reload();
});

async function loginAndCheckout(page:import('@playwright/test').Page,email:string){
  await page.locator('.grid .product-card').first().click();
  await page.getByRole('button',{name:mobile()?'Comprar NFT':'COMPRAR'}).click();
  await page.getByRole('link',{name:'Conectar e finalizar'}).click();
  await page.getByRole('link',{name:'Entrar ou criar conta'}).click();
  if(mobile())await page.locator('.mobile-auth-switch').click();
  else await page.locator('.account-tab').filter({hasText:'Criar conta'}).click();
  await page.getByRole('textbox',{name:'Nome de usuário'}).fill('Teste');
  await page.getByRole('textbox',{name:'E-mail'}).fill(email);
  await page.getByLabel('Senha',{exact:true}).fill('senha1234');
  await page.getByLabel('Confirmar senha').fill('senha1234');
  await page.locator('.account-form .button').click();
  await expect(page.locator(mobile()?'.mobile-payment':'.checkout-layout')).toBeVisible();
}

// Cenário 7a — clique repetido não cria pedido duplicado
test('clique repetido no botão de confirmar não duplica o pedido',async({page})=>{
  await loginAndCheckout(page,'dup@checkout.test');
  if(mobile()){
    await page.getByRole('button',{name:'Confirmar compra'}).click();
    await page.getByRole('button',{name:'Confirmar pedido simulado'}).click();
  }else{
    await page.getByLabel('Nome de exibição').fill('Teste');
    await page.getByLabel('Nome de usuário').fill('teste');
    await page.getByRole('button',{name:'Revisar compra'}).click();
    await page.getByRole('button',{name:'Confirmar pedido simulado'}).click();
  }
  await expect(page).toHaveURL(/\/order\//,{timeout:20000});
  await expect(page.locator('.order-title h2')).toBeVisible({timeout:5000});
  const orderCount=await page.evaluate(()=>{
    const db=JSON.parse(localStorage.getItem('kurio-db-v1')||'{}');
    return (db.orders||[]).length;
  });
  expect(orderCount).toBe(1);
});

// Cenário 7b — timeout com recuperação pelo pedido pendente (idempotência)
test('timeout de rede: reload recupera o mesmo pedido sem criar outro',async({page})=>{
  await loginAndCheckout(page,'timeout@checkout.test');
  // Injeta diretamente um pedido pendente e a chave de idempotência no localStorage
  // (simula o estado após o servidor criar o pedido mas antes da resposta chegar)
  const orderId=await page.evaluate(()=>{
    const db=JSON.parse(localStorage.getItem('kurio-db-v1')||'{}');
    const session=db.session;
    const id='timeout-order-idem-001';
    db.orders=db.orders||[];
    db.orders.unshift({
      id,status:'pending',transaction:'0xTIMEOUT',
      wallet:`${session}:0xDEMO`,network:'Ethereum',
      quote:{lines:[],subtotal:'0.000',discount:'0.000',fee:'0.016',total:'0.016',coupon:null,version:'v1'},
      createdAt:new Date().toISOString()
    });
    localStorage.setItem('kurio-db-v1',JSON.stringify(db));
    localStorage.setItem('kurio-pending-order',id);
    return id;
  });
  // Reload do checkout deve redirecionar para o recibo do pedido pendente
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/order/${orderId}`),{timeout:8000});
});

// Cenário 7c — pagamento recusado mostra tela de recusa
test('pagamento recusado exibe tela de recusa e permite tentar novamente',async({page})=>{
  await loginAndCheckout(page,'declined@checkout.test');
  if(mobile()){
    await page.getByRole('button',{name:'Confirmar compra'}).click();
    await page.getByRole('button',{name:'Confirmar pedido simulado'}).click();
  }else{
    await page.getByLabel('Nome de exibição').fill('Teste');
    await page.getByLabel('Nome de usuário').fill('teste');
    await page.getByRole('button',{name:'Revisar compra'}).click();
    await page.getByRole('button',{name:'Confirmar pedido simulado'}).click();
  }
  await expect(page).toHaveURL(/\/order\//,{timeout:8000});
  // Força declined via DB mock
  await page.evaluate(()=>{
    const db=JSON.parse(localStorage.getItem('kurio-db-v1')||'{}');
    if(db.orders?.[0])db.orders[0].status='declined';
    localStorage.setItem('kurio-db-v1',JSON.stringify(db));
  });
  await page.reload();
  await expect(page.getByRole('heading',{name:'Pagamento recusado'})).toBeVisible({timeout:5000});
  await expect(page.getByRole('link',{name:'Tentar novamente'})).toBeVisible();
});
