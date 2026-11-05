import {test,expect} from '@playwright/test';

test('banners preservam imagem, texto e CTA sem sobreposição ao redimensionar',async({page})=>{
 for(const width of [1440,900,768,390,320]){
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  const cards=page.locator('.promo-card');
  await expect(cards).toHaveCount(2);
  for(let i=0;i<2;i++){
   const card=cards.nth(i),art=card.locator('.promo-art'),cta=card.getByRole('link',{name:'Explorar'});
   await expect(card.locator('img')).toBeVisible();
   await expect(cta).toBeVisible();
   const [c,a]=await Promise.all([card.boundingBox(),art.boundingBox()]);
   expect(c&&a).toBeTruthy();
   // Em viewports largos, arte e copy ficam lado a lado; em mobile empilham
   if(width>=768){
    const t=await card.locator('.promo-copy').boundingBox();
    expect(t).toBeTruthy();
    expect(a!.x+a!.width).toBeLessThanOrEqual(t!.x+1);
   }
  }
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  expect(horizontalOverflow).toBe(false);
 }
});
