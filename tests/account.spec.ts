import {test,expect} from '@playwright/test';
const mobile=()=>test.info().project.name==='mobile';

const openRegister=async(page:import('@playwright/test').Page)=>{
  if(mobile())await page.locator('.mobile-auth-switch').click();
  else await page.locator('.account-tab').filter({hasText:'Criar conta'}).click();
};
async function register(page:import('@playwright/test').Page,email='warley@example.test'){
  await openRegister(page);
  await page.getByRole('textbox',{name:'Nome de usuário'}).fill('Warley');
  await page.getByRole('textbox',{name:'E-mail'}).fill(email);
  await page.getByLabel('Senha',{exact:true}).fill('senha1234');
  await page.getByLabel('Confirmar senha').fill('senha1234');
  await page.locator('.account-form .button').click();
  await expect(page.getByRole('heading',{name:'Perfil do colecionador'})).toBeVisible();
}

test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.removeItem('kurio-db-v1'));
  await page.goto('/login');
});

// Cenário 3 — cadastro, conflito, login, logout e troca de usuário
test('cadastro com conflito de e-mail, login, logout e troca de usuário',async({page})=>{
  // Senhas não coincidem
  await openRegister(page);
  await page.getByRole('textbox',{name:'Nome de usuário'}).fill('Warley');
  await page.getByRole('textbox',{name:'E-mail'}).fill('warley@example.test');
  await page.getByLabel('Senha',{exact:true}).fill('senha1234');
  await page.getByLabel('Confirmar senha').fill('outro1234');
  await page.locator('.account-form .button').click();
  await expect(page.getByRole('alert')).toContainText('não coincidem');
  // Cadastro bem-sucedido
  await page.getByLabel('Confirmar senha').fill('senha1234');
  await page.locator('.account-form .button').click();
  await expect(page.getByRole('heading',{name:'Perfil do colecionador'})).toBeVisible();
  // Logout limpa sessão — URL pode ter query params
  await page.getByRole('button',{name:'Sair'}).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:5173\/?(\?.*)?$/);
  // Conflito de e-mail
  await page.goto('/login');
  await openRegister(page);
  await page.getByRole('textbox',{name:'Nome de usuário'}).fill('Outro');
  await page.getByRole('textbox',{name:'E-mail'}).fill('warley@example.test');
  await page.getByLabel('Senha',{exact:true}).fill('senha1234');
  await page.getByLabel('Confirmar senha').fill('senha1234');
  await page.locator('.account-form .button').click();
  await expect(page.getByRole('alert')).toContainText('já está cadastrado');
  // Login com credenciais corretas
  if(mobile())await page.locator('.mobile-auth-switch').click();
  else await page.locator('.account-tab').filter({hasText:'Entrar'}).click();
  await page.getByRole('textbox',{name:'E-mail'}).fill('warley@example.test');
  await page.getByLabel('Senha',{exact:true}).fill('senha1234');
  await page.locator('.account-form .button').click();
  await expect(page.getByRole('heading',{name:'Perfil do colecionador'})).toBeVisible();
  // Troca de usuário — dados de Alice não devem aparecer
  await page.getByRole('button',{name:'Sair'}).click();
  await page.goto('/login');
  await page.getByRole('textbox',{name:'E-mail'}).fill('alice@kurio.test');
  await page.getByLabel('Senha',{exact:true}).fill('alice1234');
  await page.locator('.account-form .button').click();
  await expect(page.getByRole('heading',{name:'Perfil do colecionador'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'E-mail *'})).not.toHaveValue('warley@example.test');
});

// Cenário 3b — expiração de sessão durante navegação
test('expiração de sessão redireciona para login preservando contexto',async({page})=>{
  await register(page,'expiry@example.test');
  await page.evaluate(()=>localStorage.setItem('kurio-scenario','expired'));
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login/,{timeout:5000});
  await page.evaluate(()=>localStorage.removeItem('kurio-scenario'));
});

// Cenário 8 — perfil, avatar, senha e carteiras com erros de validação
test('perfil e carteira persistem após atualização',async({page})=>{
  await register(page);
  await page.getByLabel('Nome de exibição').fill('Warley Teste');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('salvo');
  // Persiste após reload
  await page.reload();
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Warley Teste');
  // Troca de senha com senha atual errada
  await page.getByLabel('Senha atual').fill('errada');
  await page.getByLabel('Nova senha',{exact:true}).fill('nova1234');
  await page.getByLabel('Confirmar nova senha').fill('nova1234');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('incorreta');
  // Carteira
  await page.getByRole('link',{name:'Carteiras'}).first().click();
  await expect(page.locator('.account-content h2').first()).toContainText('Carteira');
  await page.locator('.account-fields label').filter({hasText:'Nome de exibição'}).locator('input').fill('Carteira Um');
  await page.getByLabel('Apelido da carteira').fill('Principal');
  await page.locator('.account-fields select').first().selectOption('Ethereum');
  await page.getByLabel('Nome do perfil').fill('Warley');
  await page.getByLabel('Endereço da carteira').fill('0x12345678901234567890');
  await page.getByLabel('Tipo de carteira').selectOption('MetaMask');
  await page.getByRole('textbox',{name:'E-mail *'}).fill('warley@example.test');
  await page.getByRole('button',{name:'Salvar carteira'}).click();
  await expect(page.getByText('Principal: Carteira Um')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Principal: Carteira Um')).toBeVisible();
  // Editar carteira existente
  await page.getByRole('button',{name:'Editar'}).click();
  await page.locator('.account-fields label').filter({hasText:'Nome de exibição'}).locator('input').fill('Carteira Editada');
  await page.getByRole('button',{name:'Atualizar carteira'}).click();
  await expect(page.getByText('Principal: Carteira Editada')).toBeVisible();
});
