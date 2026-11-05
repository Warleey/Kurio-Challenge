import axios from 'axios';
import type {NFT,CartItem,Quote,Order} from './domain';
export const api=axios.create({baseURL:'/api',timeout:8000});
export const message=(e:unknown)=>axios.isAxiosError(e)?e.response?.data?.message||e.message:'Não foi possível concluir. Tente novamente.';

// Interceptor global: sessão expirada → redireciona para login preservando contexto
let _onExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void) { _onExpired = fn; }
api.interceptors.response.use(
  r => r,
  e => {
    if (axios.isAxiosError(e) && e.response?.status === 401 && e.config?.url !== '/login' && e.config?.url !== '/register') {
      _onExpired?.();
    }
    return Promise.reject(e);
  }
);
export const getNfts=async(q:Record<string,string>)=>(await api.get<{items:NFT[];total:number;pages:number}>('/nfts',{params:q})).data;
export const getNft=async(id:string)=>(await api.get<NFT>(`/nfts/${id}`)).data;
export const getCart=async()=>(await api.get<CartItem[]>('/cart')).data;
export const setCart=async(id:string,quantity:number)=>(await api.put<CartItem[]>(`/cart/${id}`,{quantity})).data;
export const getQuote=async(coupon:string)=>(await api.get<Quote>('/quote',{params:coupon?{coupon}:{}})).data;
export const getSession=async()=>(await api.get<{id:string;email:string;name:string}|null>('/session')).data;
export const getOrder=async(id:string)=>(await api.get<Order>(`/orders/${id}`)).data;
