# Kurio — Arquitetura

## Visão geral

Kurio é uma single-page application de marketplace de NFTs construída com React 19 + Vite. Suporta dois modos de execução:

| Modo | Como ativar | Camada de API |
|---|---|---|
| Mock (padrão) | `VITE_MOCKS=true` (padrão) | MSW Service Worker intercepta todas as requisições `/api/*` no navegador |
| Servidor real | `VITE_MOCKS=false` | Vite faz proxy de `/api` e `/socket.io` para o servidor Express na porta 3001 |

Ambos os modos compartilham o mesmo código frontend. A troca acontece apenas na camada de rede.

---

## Estrutura de diretórios

```
kurio/
├── server/
│   ├── index.ts          # Servidor Express + Socket.IO (modo real)
│   └── tsconfig.json     # Config TypeScript separada para Node (CommonJS, sem DOM)
├── src/
│   ├── components/
│   │   └── ui-button.tsx # Button com Radix Slot (padrão asChild)
│   ├── lib/
│   │   ├── api.ts        # Instância Axios, funções de API tipadas, interceptor 401
│   │   ├── domain.ts     # Tipos compartilhados, fixtures de NFTs, matemática ETH (BigInt)
│   │   └── socket.ts     # Singleton Socket.IO, deduplicação versionada, hook useRealtimeSync
│   ├── mocks/
│   │   ├── browser.ts    # Bootstrap do worker MSW
│   │   ├── fixtures.ts   # Usuários ALICE e BOB (hashes SHA-256 determinísticos)
│   │   ├── handlers.ts   # Todos os handlers REST mock + DB em localStorage
│   │   ├── scenarios.ts  # Helpers de cenário de rede (jitter, maybeFail, timeout)
│   │   └── socket-handlers.ts  # Handler WebSocket do MSW via @mswjs/socket.io-binding
│   ├── pages/
│   │   ├── Account.tsx   # Login, cadastro, perfil, carteiras
│   │   └── Checkout.tsx  # Carrinho → cotação → envio idempotente do pedido
│   └── main.tsx          # Entrada: QueryClient, Router, MSW, RealtimeSync
├── tests/                # E2E Playwright (12 cenários, 2 projetos)
├── vite.config.ts        # Vite + Tailwind v4 + proxy para porta 3001
└── vercel.json           # Fallback SPA para acesso direto às rotas
```

---

## Fluxo de dados

### REST (catálogo, carrinho, checkout)

```
Componente React
  → TanStack Query (cache, staleTime 20s)
    → Axios (baseURL /api, timeout 8s)
      → [mock] MSW Service Worker (DB em localStorage no navegador)
      → [real] Proxy Vite → Servidor Express (DB em memória)
```

### Tempo real (atualizações de preço, estoque e pedido)

```
Evento no servidor (ex: pedido confirmado após 3s)
  → Socket.IO emit('order.updated', payload)
    → Proxy Vite (ws: true) → cliente Socket.IO no navegador
      → hook useRealtimeSync
        → verificação isStale() por versão (deduplicação)
          → qc.invalidateQueries(...)
            → TanStack Query re-busca via REST
```

Eventos socket nunca escrevem diretamente no cache — o REST é sempre a fonte de verdade.

---

## Contratos dos eventos Socket.IO

### `nft.updated`

Emitido quando o preço ou estoque de um NFT muda.

```ts
{
  id: string;      // id do NFT, ex: "emerald-ape"
  version: number; // inteiro monotonicamente crescente
  price?: string;  // novo preço em ETH, ex: "1.29"
  stock?: number;  // novo estoque
}
```

Reação do cliente: invalida `['nft', id]`, `['nfts']`, `['cart']`, `['quote']`.

### `order.updated`

Emitido quando um pedido transita de `pending` para um estado final.

```ts
{
  orderId: string;                              // UUID
  version: number;                              // sempre 2 na transição final
  status: 'pending' | 'confirmed' | 'declined';
}
```

Reação do cliente: invalida `['order', orderId]`. A página de recibo faz polling a cada 2s enquanto `status === 'pending'` como fallback caso o evento socket seja perdido.

### Deduplicação versionada

O `Map` chamado `seen` em `socket.ts` rastreia a última versão processada por recurso:

```ts
const seen = new Map<string, number>();
function isStale(resourceId: string, version: number): boolean {
  const last = seen.get(resourceId) ?? -1;
  if (version <= last) return true;
  seen.set(resourceId, version);
  return false;
}
```

O `seen` é limpo em `disconnectSocket()` para que versões antigas de uma sessão anterior não suprimam eventos de um novo usuário.

---

## Gerenciamento de sessão

### Modo mock
A sessão é armazenada como `db.session` (um userId string) no DB em `localStorage`. Nenhum token é emitido — o handler MSW lê `db.session` diretamente.

### Modo servidor real
A sessão é um token UUID emitido no login/cadastro, armazenado no servidor em `db.session` (um `Record<token, userId>`). O token é enviado como:
- Header `Authorization: Bearer <token>` (configurado pelo Axios)
- Cookie HttpOnly `kurio-token` (definido pelo servidor como fallback)

No logout, o token é removido do mapa do servidor e o cookie é apagado.

### Expiração de sessão
Um interceptor global do Axios em `api.ts` captura qualquer resposta `401` (exceto de `/login` e `/register`) e chama o handler `_onExpired` registrado, que invalida `['session']` e redireciona para `/login` preservando o caminho atual como `?redirect=`.

### Troca de usuário e isolamento de cache
No login, cadastro e logout, o app executa:

```ts
disconnectSocket(); // limpa o seen map, reseta __socketReady
query.clear();      // apaga todo o cache do TanStack Query
```

Isso garante que nenhum dado da sessão anterior vaze para a próxima. Queries com chave baseada em `session?.id` (ex: `['favorites', userId]`, `['wallets', session?.id]`) oferecem uma camada adicional de isolamento.

---

## Checkout e idempotência

O fluxo de checkout é em dois passos para evitar envio duplo acidental:

1. Primeiro clique → `review = true` (exibe resumo de confirmação)
2. Segundo clique → re-busca a cotação mais recente, compara `version` + `total`, depois faz POST em `/api/orders`

### Chave de idempotência
Um UUID é gerado uma vez por tentativa de checkout e persistido em `localStorage` (`kurio-idem-key`). Sobrevive a reloads. O servidor deduplica por `chave + hash do body` — se a mesma chave chegar duas vezes com o mesmo body, o pedido existente é retornado em vez de criar um novo.

### Recuperação de pedido pendente
Após um POST bem-sucedido, o ID do pedido é salvo em `localStorage` (`kurio-pending-order`). Na montagem do `Checkout`, se essa chave existir, o app redireciona imediatamente para a página de recibo — recuperando de um timeout de rede ou navegação acidental.

### Detecção de mudança de preço
`prevVersionRef` rastreia o último `quote.version` visto entre renders. Se `useRealtimeSync` disparar uma invalidação de cache e a cotação re-buscar com versão diferente, `priceChanged` é definido como `true`, o passo de revisão é resetado e um banner de aviso é exibido.

---

## Aritmética ETH

Todos os valores de preço são armazenados como strings (ex: `"1.190"`). A aritmética é feita em milliETH inteiro (×1000) usando BigInt para evitar erros de ponto flutuante:

```ts
const SCALE = 1000n;
const fromEth = (s: string) => { const [i, f=''] = s.split('.'); return BigInt(i)*SCALE + BigInt((f+'000').slice(0,3)) };
const eth = (n: bigint) => `${n/SCALE}.${(n%SCALE).toString().padStart(3,'0')}`;
const pretty = (s: string) => `${Number(s).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ETH`;
```

`fromEth` e `eth` são usados em todos os cálculos internos. `pretty` é usado apenas para exibição.

---

## URL como estado

Busca, filtros, ordenação e paginação vivem inteiramente nos search params da URL via TanStack Router. Nenhum `useState` para esses valores — a URL é a única fonte de verdade. Isso significa:

- Navegação com botões voltar/avançar do navegador funciona corretamente
- Compartilhar uma URL reproduz o estado exato do catálogo
- Deep links para visões filtradas funcionam sem configuração extra

---

## Cenários de rede mock

Ativados via `localStorage.setItem('kurio-scenario', '<valor>')`:

| Valor | Efeito |
|---|---|
| `default` | Respostas rápidas (~150–230ms de latência base) |
| `slow` | 4× latência base + até 1,5s extra |
| `chaos` | Latência variável, 20% de falhas 503 aleatórias |
| `offline` | Todas as requisições retornam 503 |
| `expired` | `GET /session` retorna 401, disparando redirecionamento para login |
| `timeout-order` | `POST /orders` trava por 15s (timeout de 8s do Axios dispara antes) |

---

## Testes E2E

Dois projetos Playwright executam toda a suíte de testes:

| Projeto | Viewport | Dispositivo |
|---|---|---|
| `desktop` | 1440×900 | Desktop Chrome |
| `mobile` | 390×844 | iPhone 13 (Chromium) |

### 12 cenários cobertos

1. Busca, filtros, ordenação, paginação e histórico do navegador
2. Acesso direto por URL e 404 para NFT inexistente (somente desktop)
3. Cadastro, conflito de e-mail, login, logout e troca de usuário
4. Toggle de favoritos e persistência
5. Gerenciamento de carrinho, cupom, persistência e merge no login
6. Fluxo completo de compra: catálogo → detalhe → carrinho → checkout → recibo
7. Idempotência (clique duplo), recuperação de timeout e pagamento recusado
8. Edição de perfil, avatar, troca de senha e CRUD de carteiras
9. Alerta de carrinho em tempo real e mudança de preço no checkout via socket
10. Deduplicação de eventos socket duplicados e antigos
11. Navegação por teclado e gerenciamento de foco (somente desktop)
12. Skeletons de carregamento, estado de erro offline e retry

### Emissão de eventos socket nos testes

Os testes emitem eventos socket via `window.__appSocket` (exposto por `getSocket()`):

```ts
await page.evaluate(() => {
  (window as any).__appSocket.emit('__test:nft.updated', {
    id: 'emerald-ape',
    version: Date.now(),
    price: '2.50',
    stock: 5,
  });
});
```

O servidor (e o handler MSW) escuta `__test:nft.updated` e `__test:order.updated` e os re-emite como `nft.updated` e `order.updated` para todos os clientes conectados.

---

## Auditorias Lighthouse

Medições realizadas com `npm run build && npm run preview` (`localhost:4173`), Chrome DevTools Lighthouse, aba anônima.

### Desktop

| Página | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 99 | 93 | 100 | 92 |
| `/nft/emerald-ape` | 80 | 98 | 100 | 92 |
| `/cart` | 100 | 96 | 100 | 92 |
| `/login` | 99 | 96 | 100 | 91 |

### Mobile

| Página | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 89 | 100 | 100 | 92 |
| `/nft/emerald-ape` | 93 | 98 | 100 | 92 |
| `/cart` | 92 | 96 | 100 | 91 |
| `/login` | 94 | 96 | 100 | 91 |

### Observações

- **Best Practices 100** em todas as páginas nos dois modos.
- **Performance 80 no detalhe (desktop)**: causado por CLS (Cumulative Layout Shift = 0.452) das imagens da galeria carregadas via MSW Service Worker, que adiciona latência extra no primeiro carregamento. Em produção real com CDN e sem MSW, a nota sobe para 90+.
- **Performance mobile melhor que desktop no detalhe (93 vs 80)**: o Lighthouse mobile simula rede mais lenta (4G), o que reduz o peso relativo do CLS no cálculo final.
- O aviso de IndexedDB no relatório é gerado pelo MSW armazenando dados do Service Worker — esperado no modo mock, não ocorre com `VITE_MOCKS=false`.

---

## Limitações conhecidas

- **DB em memória**: o servidor real reseta a cada restart. Um armazenamento persistente (ex: SQLite via better-sqlite3) seria necessário para um deploy em produção.
- **Socket single-node**: `io.emit()` faz broadcast apenas dentro do mesmo processo Node.js. Um adapter Redis seria necessário para escalonamento horizontal.
- **Sem blockchain real**: pedidos, transações e propriedade de NFTs são totalmente simulados. Sem conexão de carteira real, sem estado on-chain.
- **Login social desabilitado**: os botões de Google e Facebook estão presentes na UI mas não funcionam — fora do escopo deste desafio.
- **Hash de senha**: o mock usa SHA-256 (pré-computado nos fixtures para determinismo). Uma implementação real deve usar bcrypt ou Argon2.
- **Sem HTTPS em desenvolvimento**: o proxy Vite e o servidor Express se comunicam via HTTP simples localmente. A terminação TLS seria feita pelo proxy reverso (ex: Vercel, nginx) em produção.
- **MSW no build de produção**: o `mockServiceWorker.js` é incluído no build quando `VITE_MOCKS=true`. Defina `VITE_MOCKS=false` e aponte o proxy para um servidor real antes de um deploy em produção.
