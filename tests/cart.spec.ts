import {test,expect} from '@playwright/test';
const mobile=()=>test.info().project.name==='mobile';

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.removeItem('kurio-db-v1'));
  await page.reload();
});

async function addToCart(page:import('@playwright/test').Page){
  await page.locator('.grid .product-card').first().click();
  await page.getByRole('button',{name:mobile()?'Comprar NFT':'COMPRAR'}).click();
  await expect(page.locator(mobile()?'.mobile-cart-card':'.cart-row').first()).toBeVisible();
}

// Cenário 5 — carrinho: quantidades, remoção, cupom, persistência após refresh e merge no login
test('carrinho: edição, remoção, cupom inválido, cupom válido e persistência',async({page})=>{
  await addToCart(page);
  // Aumenta quantidade — no mobile o stepper fica em .mobile-cart-controls
  const stepperBtn=mobile()
    ? page.locator('.mobile-cart-controls .stepper button[aria-label*="Aumentar"]').first()
    : page.locator('.cart-row .stepper button[aria-label*="Aumentar"]').first();
  await stepperBtn.click({force:true});
  const stepperSpan=mobile()
    ? page.locator('.mobile-cart-controls .stepper span').first()
    : page.locator('.cart-row .stepper span').first();
  await expect(stepperSpan).toHaveText('2');
  // Cupom inválido — filtra pelo erro de cupom especificamente
  await page.getByLabel('Código promocional').fill('INVALIDO');
  await page.getByRole('button',{name:'Aplicar'}).click();
  await expect(page.locator('.summary .error').first()).toContainText(/inválido|expirado/i);
  // Cupom válido
  await page.getByLabel('Código promocional').fill('KURIO10');
  await page.getByRole('button',{name:'Aplicar'}).click();
  await expect(page.locator('dl').getByText(/Desconto/)).toBeVisible();
  // Persistência após refresh
  await page.reload();
  await expect(page.locator(mobile()?'.mobile-cart-card':'.cart-row').first()).toBeVisible();
  // Remoção
  await page.locator(mobile()?'.mobile-cart-remove':'button[aria-label*="Remover"]').first().dispatchEvent('click');
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible();
});

test('carrinho anônimo é preservado após login',async({page})=>{
  await addToCart(page);
  await page.goto('/login');
  await page.getByRole('textbox',{name:'E-mail'}).fill('alice@kurio.test');
  await page.getByLabel('Senha',{exact:true}).fill('alice1234');
  await page.locator('.account-form .button').click();
  await expect(page.getByRole('heading',{name:'Perfil do colecionador'})).toBeVisible();
  await page.goto('/cart');
  await expect(page.locator(mobile()?'.mobile-cart-card':'.cart-row').first()).toBeVisible();
});
