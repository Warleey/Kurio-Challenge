import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.removeItem('kurio-db-v1'));
  await page.reload();
  await expect(page.locator('.grid .product-card').first()).toBeVisible({timeout:15000});
});

const isMobile=()=>test.info().project.name==='mobile';
const shot=(fp=true)=>({fullPage:fp,maxDiffPixelRatio:0.02} as const);

test('visual: home',async({page})=>{
  await expect(page).toHaveScreenshot('home.png',shot(!isMobile()));
});

test('visual: detalhe do NFT',async({page})=>{
  await page.goto('/nft/emerald-ape');
  await expect(page.getByRole('heading',{name:'Emerald Ape #042'})).toBeVisible({timeout:10000});
  await expect(page).toHaveScreenshot('nft-detail.png',shot(!isMobile()));
});

test('visual: carrinho',async({page})=>{
  const mobile=test.info().project.name==='mobile';
  await page.locator('.grid .product-card').first().click();
  await page.getByRole('button',{name:/Comprar NFT|COMPRAR/}).click();
  if(mobile){
    await expect(page.locator('.mobile-cart-card').first()).toBeVisible({timeout:10000});
  }else{
    await expect(page.locator('.cart-row').first()).toBeVisible({timeout:10000});
  }
  const alert=page.getByRole('alert').getByRole('button');
  if(await alert.isVisible())await alert.click();
  await expect(page).toHaveScreenshot('cart.png',shot(!isMobile()));
});

test('visual: login',async({page})=>{
  await page.goto('/login');
  await expect(page.getByRole('dialog')).toBeVisible({timeout:8000});
  await expect(page).toHaveScreenshot('login.png',shot());
});
