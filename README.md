# Kurio — NFT Marketplace

Marketplace de NFTs construído como desafio técnico frontend. Suporta modo mock completo (MSW + Socket.IO simulado) e modo servidor real (Express + Socket.IO).

**Deploy:** [kurio-challenge.vercel.app](https://kurio-challenge.vercel.app)

---

## Requisitos

- Node.js 20+
- npm 10+

---

## Instalação

```bash
git clone https://github.com/Warleey/kurio-challenge.git
cd kurio-challenge
npm install
```

---

## Variáveis de ambiente

Crie um `.env` na raiz (ou use os valores padrão — o modo mock funciona sem nenhuma configuração):

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_MOCKS` | `true` | `true` ativa o MSW (modo mock). `false` usa o servidor Express. |
| `VITE_SCENARIO` | `default` | Cenário de rede inicial (pode ser sobrescrito via localStorage). |

---

## Comandos

```bash
# Desenvolvimento com mocks (padrão)
npm run dev

# Desenvolvimento com servidor real (requer dois terminais)
npm run dev:server   # terminal 1 — inicia Express na porta 3001
npm run dev          # terminal 2 — inicia Vite

# Build de produção
npm run build

# Preview do build (usado para auditorias Lighthouse)
npm run preview

# Verificação de tipos
npm run typecheck

# Testes E2E (Playwright)
npm run test:e2e

# Testes E2E com interface visual
npx playwright test --ui

# Relatório HTML dos testes
npx playwright show-report
```

---

## Credenciais fictícias

Dois usuários pré-cadastrados estão disponíveis no modo mock:

| Usuário | E-mail | Senha | Observação |
|---|---|---|---|
| Alice Collector | `alice@kurio.test` | `alice1234` | Tem favoritos e carteira cadastrada |
| Bob Trader | `bob@kurio.test` | `bob1234` | Tem carrinho com 2 itens |

Você também pode criar uma conta nova diretamente pela tela de cadastro. Qualquer e-mail fictício funciona.

---

## Cenários de rede mock

Ativados via `localStorage` no console do navegador:

```js
// Ativar cenário
localStorage.setItem('kurio-scenario', 'slow')
location.reload()

// Desativar (volta ao padrão)
localStorage.removeItem('kurio-scenario')
location.reload()
```

| Cenário | Efeito |
|---|---|
| `default` | Respostas rápidas (~150–230ms) |
| `slow` | 4× latência + até 1,5s extra |
| `chaos` | Latência variável, 20% de falhas 503 aleatórias |
| `offline` | Todas as requisições retornam 503 |
| `expired` | `GET /session` retorna 401, disparando redirect para login |
| `timeout-order` | `POST /orders` trava por 15s (timeout de 8s do Axios dispara antes) |

---

## Reset do banco de dados mock

Para restaurar o estado inicial (fixtures originais de Alice e Bob):

```js
// Via console do navegador
fetch('/api/demo/reset', { method: 'POST' }).then(() => location.reload())
```

Ou manualmente:

```js
localStorage.removeItem('kurio-db-v1')
location.reload()
```

---

## Reproduzindo os fluxos de falha

### Timeout de rede no checkout

1. Adicione um NFT ao carrinho
2. Vá para o checkout e faça login
3. No console: `localStorage.setItem('kurio-scenario', 'timeout-order')`
4. Confirme o pedido — o Axios vai dar timeout em 8s
5. Recarregue a página — o checkout redireciona automaticamente para o recibo do pedido já criado

### Sessão expirada durante navegação

1. Faça login com qualquer conta
2. No console: `localStorage.setItem('kurio-scenario', 'expired')`
3. Navegue para `/profile` — o app redireciona para `/login?redirect=/profile`
4. Após login, retorna automaticamente para `/profile`

### Mudança de preço durante o checkout

1. Adicione um NFT ao carrinho e vá para o checkout
2. Clique em "Revisar compra" (primeiro passo)
3. No console, altere o preço no DB:
```js
const db = JSON.parse(localStorage.getItem('kurio-db-v1'))
db.products.find(p => p.id === 'emerald-ape').price = '9.99'
db.products.find(p => p.id === 'emerald-ape').version = Date.now()
localStorage.setItem('kurio-db-v1', JSON.stringify(db))
```
4. Clique em "Confirmar pedido simulado" — o app detecta a mudança de versão e bloqueia

### Pagamento recusado

O servidor simula recusa em ~15% dos pedidos aleatoriamente. Para forçar:

1. Finalize um pedido e aguarde a tela de recibo
2. No console:
```js
const db = JSON.parse(localStorage.getItem('kurio-db-v1'))
db.orders[0].status = 'declined'
localStorage.setItem('kurio-db-v1', JSON.stringify(db))
location.reload()
```

### Evento Socket.IO manual

```js
// No console do navegador (com a página aberta)
window.__appSocket.emit('__test:nft.updated', {
  id: 'emerald-ape',
  version: Date.now(),
  price: '2.50',
  stock: 5,
})
```

---

## Testes E2E

```bash
# Roda todos os testes (desktop + mobile)
npm run test:e2e

# Apenas desktop
npx playwright test --project=desktop

# Apenas mobile
npx playwright test --project=mobile

# Um arquivo específico
npx playwright test tests/realtime.spec.ts

# Com traces em todas as execuções
npx playwright test --trace=on
```

Os traces ficam em `playwright-report/`. Para visualizar:

```bash
npx playwright show-report
```

---

## Auditoria Lighthouse

```bash
# 1. Gera o build otimizado
npm run build

# 2. Sobe o preview
npm run preview
# → http://localhost:4173

# 3. Abre o Chrome em modo anônimo e rode o Lighthouse nas páginas:
#    /  |  /nft/emerald-ape  |  /cart  |  /login
#    Perfis: Desktop e Mobile
#    Execute 3 vezes por página e use a mediana
```

Resultados registrados em `ARCHITECTURE.md`.

---

## Documentação técnica

Consulte [`ARCHITECTURE.md`](./ARCHITECTURE.md) para:

- Contratos REST completos (todos os endpoints, parâmetros e códigos de erro)
- Contratos dos eventos Socket.IO (`nft.updated`, `order.updated`)
- Estratégia de cache e invalidação (TanStack Query)
- Política de sessão (mock vs. servidor real)
- Fluxo de idempotência do checkout
- Reconciliação entre REST e Socket.IO
- Decisões de UX e desvios do Figma
- Limitações conhecidas
