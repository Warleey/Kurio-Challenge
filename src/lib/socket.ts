import { io, Socket } from 'socket.io-client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    if (typeof window !== 'undefined') {
      (window as any).__appSocket = socket;
      (window as any).__socketReady = true;
    }
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  seen.clear();
  if (typeof window !== 'undefined') (window as any).__socketReady = false;
}

const seen = new Map<string, number>();
function isStale(resourceId: string, version: number): boolean {
  const last = seen.get(resourceId) ?? -1;
  if (version <= last) return true;
  seen.set(resourceId, version);
  return false;
}

export interface NftUpdatedPayload {
  id: string;
  version: number;
  price?: string;
  stock?: number;
}

export interface OrderUpdatedPayload {
  orderId: string;
  version: number;
  status: 'pending' | 'confirmed' | 'declined';
}

export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    function onNftUpdated(payload: NftUpdatedPayload) {
      if (isStale(`nft:${payload.id}`, payload.version)) return;
      // Reconcilia com REST — invalida catálogo, detalhe e carrinho
      qc.invalidateQueries({ queryKey: ['nft', payload.id] });
      qc.invalidateQueries({ queryKey: ['nfts'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['quote'] });
    }

    function onOrderUpdated(payload: OrderUpdatedPayload) {
      if (isStale(`order:${payload.orderId}`, payload.version)) return;
      qc.invalidateQueries({ queryKey: ['order', payload.orderId] });
    }

    s.on('nft.updated', onNftUpdated);
    s.on('order.updated', onOrderUpdated);

    s.on('connect', () => {
      qc.invalidateQueries({ queryKey: ['nfts'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['quote'] });
    });

    return () => {
      s.off('nft.updated', onNftUpdated);
      s.off('order.updated', onOrderUpdated);
      s.off('connect');
    };
  }, [qc]);
}
