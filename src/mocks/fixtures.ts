/**
 * Fixtures determinísticas para testes E2E e demonstração.
 *
 * Usuário 1 — colecionador principal:
 *   email: alice@kurio.test  senha: alice1234
 *
 * Usuário 2 — colecionador secundário:
 *   email: bob@kurio.test    senha: bob1234
 *
 * Ambos são criados no reset do banco (POST /api/demo/reset ou remoção de kurio-db-v1).
 * As senhas estão em SHA-256 pré-computado para não depender de crypto.subtle no boot.
 */

export const ALICE = {
  id: 'user-alice-0000-0000-0000-000000000001',
  name: 'Alice Collector',
  email: 'alice@kurio.test',
  username: 'alice',
  // SHA-256 de "alice1234"
  passwordHash: '0771382e88bb08402547cd4bfd0f3a7fc742e9e27fea8889db6207ee23b9c82e',
  favorites: ['emerald-ape', 'sage-nomad'],
  wallets: [{
    id: 'wallet-alice-0001',
    name: 'Carteira Principal',
    alias: 'Principal',
    address: '0xALICE000000000000000000000000000000000001',
    network: 'Ethereum',
    profileName: 'Alice',
    email: 'alice@kurio.test',
    walletType: 'MetaMask',
  }],
};

export const BOB = {
  id: 'user-bob-00000-0000-0000-000000000002',
  name: 'Bob Trader',
  email: 'bob@kurio.test',
  username: 'bob',
  // SHA-256 de "bob1234"
  passwordHash: '550c7a6d0859d0773541dd478bd49214188b9358549d3519ea542442f86e079c',
  favorites: ['golden-beat', 'ivory-baron'],
  wallets: [{
    id: 'wallet-bob-0001',
    name: 'Carteira Bob',
    alias: 'Principal',
    address: '0xBOB0000000000000000000000000000000000002',
    network: 'Polygon',
    profileName: 'Bob',
    email: 'bob@kurio.test',
    walletType: 'WalletConnect',
  }],
};

// Carrinhos iniciais para demonstração
export const ALICE_CART = [
  { id: 'emerald-ape', quantity: 1 },
];

export const BOB_CART = [
  { id: 'golden-beat', quantity: 2 },
  { id: 'ivory-baron', quantity: 1 },
];
