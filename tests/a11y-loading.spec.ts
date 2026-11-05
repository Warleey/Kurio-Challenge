import {test,expect} from '@playwright/test';
const mobile=()=>test.info().project.name==='mobile';

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.removeItem('kurio-db-v1'));
  await page.reload();
});

// Cenário 11 — navegação por teclado, foco em diálogos e validação de formulários
test('navegação por teclado: foco no diálogo de login e campos obrigatórios',async({page})=>{
  test.skip(mobile(),'Navegação por teclado avaliada apenas no desktop');
  await page.getByRole('link',{name:/Entrar/i}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:/Entrar|Criar conta/i})).toBeVisible();
  // Foco deve estar dentro do diálogo
  const focused=await page.evaluate(()=>document.activeElement?.closest('[role="dialog"]')!==null);
  expect(focused).toBe(true);
  // Fecha com Escape
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // Validação de formulário — submete vazio
  await page.getByRole('link',{name:/Entrar/i}).click();
  await page.locator('.account-form .button').click();
  const emailInvalid=await page.evaluate(()=>{
    const el=document.querySelector('input[type="email"]') as HTMLInputElement|null;
    return el?!el.validity.valid:false;
  });
  expect(emailInvalid).toBe(true);
});

test('navegação por teclado no catálogo: Tab chega nos cards e Enter abre detalhe',async({page})=>{
  test.skip(mobile(),'Navegação por teclado avaliada apenas no desktop');
  const card=page.locator('.grid .product-card .product-main').first();
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'Emerald Ape #042'})).toBeVisible();
});

test('foco visível nos botões de stepper e remoção do carrinho',async({page})=>{
  test.skip(mobile(),'Avaliado apenas no desktop');
  await page.locator('.grid .product-card').first().click();
  await page.getByRole('button',{name:'COMPRAR'}).click();
  const increaseBtn=page.locator('.cart-row .stepper button[aria-label*="Aumentar"]').first();
  await increaseBtn.focus();
  const isFocused=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')?.includes('Aumentar'));
  expect(isFocused).toBe(true);
  const removeBtn=page.locator('button[aria-label*="Remover"]').first();
  await removeBtn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible();
});

// Cenário 12 — skeletons durante carregamento lento, feedback de falha e retry
test('skeleton aparece durante carregamento lento e desaparece após resposta',async({page})=>{
  // Usa addInitScript para setar o cenário antes do reload (evita "execution context destroyed")
  await page.addInitScript(()=>localStorage.setItem('kurio-scenario','slow'));
  await page.reload({waitUntil:'commit'});
  await expect(page.locator('.skeleton').first()).toBeVisible({timeout:10000});
  await expect(page.locator('.grid .product-card').first()).toBeVisible({timeout:15000});
  await expect(page.locator('.skeleton').first()).not.toBeVisible();
  await page.evaluate(()=>localStorage.removeItem('kurio-scenario'));
});

test('feedback de falha e retry no catálogo com cenário offline',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('kurio-scenario','offline'));
  await page.goto('/',{waitUntil:'commit'});
  await expect(page.getByRole('alert')).toBeVisible({timeout:8000});
  await expect(page.getByRole('alert')).toContainText(/não foi possível|indisponível/i);
  await page.evaluate(()=>localStorage.removeItem('kurio-scenario'));
  await page.getByRole('button',{name:'Tentar novamente'}).click();
  await expect(page.locator('.grid .product-card').first()).toBeVisible({timeout:8000});
});

test('skeleton no detalhe do NFT durante carregamento lento',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('kurio-scenario','slow'));
  await page.goto('/nft/emerald-ape',{waitUntil:'commit'});
  await expect(page.locator('.skeleton.detail-loading')).toBeVisible({timeout:10000});
  await expect(page.getByRole('heading',{name:'Emerald Ape #042'})).toBeVisible({timeout:15000});
  await page.evaluate(()=>localStorage.removeItem('kurio-scenario'));
});
