
export type Scenario = 'default' | 'slow' | 'chaos' | 'offline' | 'expired' | 'timeout-order';

export function getScenario(): Scenario {
  try {
    const ls = localStorage.getItem('kurio-scenario') as Scenario | null;
    if (ls) return ls;
  } catch {}
  const env = import.meta.env.VITE_SCENARIO as Scenario | undefined;
  return env ?? 'default';
}

// Retorna delay em ms conforme o cenário ativo
export async function jitter(base = 150): Promise<void> {
  const s = getScenario();
  let ms: number;
  if (s === 'slow') {
    ms = base * 4 + Math.random() * 1500;
  } else if (s === 'chaos') {
    // Latência variável: às vezes rápido, às vezes muito lento
    ms = Math.random() < 0.3 ? base * 8 + Math.random() * 3000 : base + Math.random() * 400;
  } else {
    ms = base + Math.random() * 80;
  }
  await new Promise(r => setTimeout(r, ms));
}

// Retorna true se POST /orders deve travar (simula timeout de rede)
export function shouldTimeoutOrder(): boolean {
  return getScenario() === 'timeout-order';
}

// Lança erro 503 aleatório no cenário chaos (20% das chamadas) ou sempre no offline
export function maybeFail(): Response | null {
  const s = getScenario();
  if (s === 'offline') return new Response(JSON.stringify({ message: 'Serviço indisponível' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  if (s === 'chaos' && Math.random() < 0.2) return new Response(JSON.stringify({ message: 'Falha transitória. Tente novamente.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  return null;
}
