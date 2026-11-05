import {test,expect} from '@playwright/test';

test.afterEach(async({page})=>{
  await page.evaluate(()=>localStorage.removeItem('kurio-scenario')).catch(()=>{});
});

test.setTimeout(60000);

test('mobile: texto do hero, cards e barra de ações não se sobrepõem em diferentes larguras',async({page})=>{
 test.skip(test.info().project.name==='mobile','A própria suíte alterna larguras dentro do Chromium desktop.');
 for(const width of [320,360,390,414,480,640]){
  await page.setViewportSize({width,height:896});
  await page.goto('/');
  await expect(page.getByRole('textbox',{name:'Explorar coleções'})).toBeVisible();
  await expect(page.locator('.grid .product-card').first()).toBeVisible();
  const metrics=await page.evaluate(()=>{
   const p=document.querySelector('.mobile-home-copy p')!.getBoundingClientRect();
   const c=document.querySelector('.mobile-home-copy a')!.getBoundingClientRect();
   const nav=document.querySelector('.mobile-bottom-nav')!.getBoundingClientRect();
   return {doc:document.documentElement.scrollWidth,view:innerWidth,paragraphBottom:p.bottom,linkTop:c.top,navRight:nav.right};
  });
  expect(metrics.doc).toBeLessThanOrEqual(metrics.view);
  expect(metrics.linkTop).toBeGreaterThanOrEqual(metrics.paragraphBottom-1);
  expect(metrics.navRight).toBeLessThanOrEqual(metrics.view+1);
  await page.locator('.grid .product-card .product-main').first().click();
  await expect(page.getByRole('button',{name:'Comprar NFT'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'Comprar NFT'}).click();
  await expect(page.locator('.mobile-cart-card').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
});
