import {ChevronLeft,Wallet as WalletIcon,MoreVertical,AlertTriangle} from 'lucide-react';
import React,{useState,useRef,useEffect} from 'react';
import {Link,useNavigate} from '@tanstack/react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api,getCart,getQuote,getSession,message} from '../lib/api';
import {getOrder} from '../lib/api';
import {pretty} from '../lib/domain';
import {Button} from '../components/ui-button';

const PENDING_KEY='kurio-pending-order';

export function Checkout(){
 const {data:session,isPending:sLoading}=useQuery({queryKey:['session'],queryFn:getSession});
 const {data:items=[]}=useQuery({queryKey:['cart'],queryFn:getCart});
 const {data:quote,isPending,dataUpdatedAt}=useQuery({queryKey:['quote',items,''],queryFn:()=>getQuote('')});
 const {data:wallets=[]}=useQuery({queryKey:['wallets',session?.id],queryFn:async()=>(await api.get<{id:string;name:string;address:string;network:string}[]>('/wallets')).data,enabled:!!session});
 const query=useQueryClient(),nav=useNavigate();
 const [display,setDisplay]=useState(''),[username,setUsername]=useState(''),[wallet,setWallet]=useState('MetaMask'),[network,setNetwork]=useState('Ethereum'),[address,setAddress]=useState('0xDEMO000000000000000000000000000000000000'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[review,setReview]=useState(false);
 useEffect(()=>{if(session){setDisplay(d=>d||session.name);setUsername(u=>u||(session as any).username||session.name);}},[session]);
 // Chave de idempotencia persistida — sobrevive a reload
 const [key]=useState(()=>{
 const saved=localStorage.getItem('kurio-idem-key');
 if(saved)return saved;
 const fresh=crypto.randomUUID();
 localStorage.setItem('kurio-idem-key',fresh);
 return fresh;
 });
 // Ao montar: se ja existe pedido pendente com essa chave, redireciona direto
 useEffect(()=>{
 const pendingId=localStorage.getItem(PENDING_KEY);
 if(!pendingId)return;
 getOrder(pendingId).then(o=>{
 if(o&&(o.status==='pending'||o.status==='confirmed'||o.status==='declined')){
 nav({to:'/order/$id',params:{id:pendingId}});
 }
 }).catch(()=>localStorage.removeItem(PENDING_KEY));
 },[nav]);
 // Detecta quando a quote foi atualizada em segundo plano (evento nft.updated)
 const prevVersionRef=useRef<string|undefined>(undefined);
 const [priceChanged,setPriceChanged]=useState(false);
 useEffect(()=>{
 if(!quote)return;
 if(prevVersionRef.current&&prevVersionRef.current!==quote.version){setPriceChanged(true);setReview(false);}
 prevVersionRef.current=quote.version;
 },[quote,dataUpdatedAt]);
 if(sLoading||isPending)return <div className="shell page"><div className="skeleton detail-loading"/></div>;
 if(!session)return <div className="shell auth"><div className="auth-box"><h2>Entre para finalizar sua compra</h2><p>Seu carrinho ficará salvo.</p><Button asChild><Link to="/login" search={{redirect:'/checkout'}}>Entrar ou criar conta</Link></Button></div></div>;
 if(!items.length||!quote?.lines.length)return <div className="shell page"><div className="empty">Seu carrinho está vazio. <Link to="/">Voltar ao mercado</Link></div></div>;
 async function submit(e?:React.FormEvent){e?.preventDefault();if(!review){setReview(true);return}setBusy(true);setError('');try{const latest=await getQuote('');if(latest.version!==quote!.version||latest.total!==quote!.total){query.invalidateQueries({queryKey:['quote']});setReview(false);setError('Os valores mudaram. Revise a cotação antes de confirmar.');return}const {data:order}=await api.post('/orders',{key,version:quote!.version,coupon:null,wallet:`${wallet} (${address})`,network});localStorage.setItem(PENDING_KEY,order.id);query.invalidateQueries({queryKey:['cart']});localStorage.removeItem('kurio-idem-key');localStorage.removeItem(PENDING_KEY);await nav({to:'/order/$id',params:{id:order.id}})}catch(e){setError(message(e));setReview(false)}finally{setBusy(false)}}
 return <div className="shell page payment-page">{priceChanged&&<div className="realtime-alert" role="alert"><AlertTriangle size={16}/> O preço ou disponibilidade de um NFT mudou. Revise os valores antes de confirmar.<button onClick={()=>setPriceChanged(false)}>✕</button></div>}<div className="mobile-payment"><div className="mobile-payment-head"><Link to="/cart" aria-label="Voltar ao carrinho"><ChevronLeft size={22}/></Link><h1>Pagamento com carteira</h1></div><div className="mobile-wallet-head"><h2>Carteira conectada</h2><Link to="/wallets">Trocar carteira</Link></div>{wallets.length?wallets.map(w=><button key={w.id} type="button" className={address===w.address?'mobile-wallet-card active':'mobile-wallet-card'} onClick={()=>{setAddress(w.address);setNetwork(w.network);setReview(false)}}><span className="radio-dot"/><span><b>{w.name}</b><small>{w.address}</small><small>Rede {w.network}</small></span><MoreVertical size={16}/></button>):<button type="button" className="mobile-wallet-card active" onClick={()=>{setAddress('0xDEMO000000000000000000000000000000000000');setNetwork('Ethereum')}}><span className="radio-dot"/><span><b>Carteira de demonstração</b><small>0xDEMO…</small><small>Rede Ethereum · simulação</small></span><MoreVertical size={16}/></button>}<h2>Carteira e rede</h2>{['WalletConnect','MetaMask','Coinbase Wallet'].map((label,index)=><button type="button" className={wallet===label?'mobile-provider active':'mobile-provider'} key={label} onClick={()=>{setWallet(label);setReview(false)}}><span className="provider-icon">{index===0?'W':index===1?'M':<WalletIcon size={18}/>}</span><span>{label}</span><span className="radio-dot"/></button>)}<label className="mobile-network-label">Rede <select value={network} onChange={e=>{setNetwork(e.target.value);setReview(false)}}><option>Ethereum</option><option>Polygon</option><option>Solana</option></select></label></div><div className="mobile-payment-bottom"><div>Total: <strong className="accent">{pretty(quote.total)}</strong></div>{review&&<p role="status">Revise sua compra: {quote.lines.length} NFT(s) · {wallet} · {network}. Nenhuma transação real será feita.</p>}{error&&<p role="alert" className="error">{error}</p>}<Button className="wide" onClick={()=>submit()} disabled={busy}>{busy?'Enviando...':review?'Confirmar pedido simulado':'Confirmar compra'}</Button></div><div className="crumb"><Link to="/">Início</Link> / Mercado / Pagamento</div><form className="checkout-layout" onSubmit={submit}><div><h3>Perfil do colecionador</h3><div className="form-grid"><label>Nome de exibição <em>*</em><input required value={display} onChange={e=>{setDisplay(e.target.value);setReview(false)}}/></label><label>Nome de usuário <em>*</em><input required value={username} onChange={e=>{setUsername(e.target.value);setReview(false)}}/></label><label>Rede <em>*</em><select value={network} onChange={e=>setNetwork(e.target.value)}><option>Ethereum</option><option>Polygon</option><option>Solana</option></select></label><label>Nome do perfil <em>*</em><input required defaultValue={session.name}/></label><label>Endereço da carteira <em>*</em><input required minLength={8} value={address} onChange={e=>{setAddress(e.target.value);setReview(false)}}/></label><label>Carteira secundária (opcional)<input placeholder="ENS ou carteira secundária"/></label><label>Tipo de carteira <em>*</em><select value={wallet} onChange={e=>setWallet(e.target.value)}><option>MetaMask</option><option>Coinbase Wallet</option><option>WalletConnect</option></select></label><label>Código de indicação (opcional)<input placeholder="Se você tiver um código"/></label><label>E-mail <em>*</em><input required type="email" defaultValue={session.email}/></label><label>Nome ENS (opcional)<input placeholder="nome.eth"/></label></div><label className="notes">Observação do colecionador (opcional)<textarea/></label></div><aside className="checkout-summary"><h3>Seus NFTs</h3><div className="receipt-head">NFTs <span>Subtotal</span></div>{quote.lines.map(l=><div key={l.id} className="receipt-line"><img src={l.image} alt=""/><div><b>{l.name}</b><small>(× {l.quantity})</small></div><strong className="accent">{pretty(l.total)}</strong></div>)}<dl><div><dt>Subtotal</dt><dd>{pretty(quote.subtotal)}</dd></div><div><dt>Desconto</dt><dd>− {pretty(quote.discount)}</dd></div><div><dt>Taxa de rede</dt><dd>{pretty(quote.fee)}</dd></div><div className="total"><dt>Total</dt><dd className="accent">{pretty(quote.total)}</dd></div></dl><h3>Carteira e rede</h3><p className="muted">{wallet} · {network} · conexão simulada</p>{wallets.length>0&&<label>Usar carteira salva<select onChange={e=>{const w=wallets.find(w=>w.id===e.target.value);if(w){setAddress(w.address);setNetwork(w.network)}}}><option value="">Escolher carteira...</option>{wallets.map(w=><option value={w.id} key={w.id}>{w.name} — {w.network}</option>)}</select></label>}{review&&<div className="review" role="status"><b>Revise sua compra</b><p>{quote.lines.length} NFT(s) · Total {pretty(quote.total)} · {wallet} / {network}</p><p>Esta é uma simulação: nenhuma transação real será feita.</p></div>}{error&&<p className="error" role="alert">{error}</p>}<Button className="wide" disabled={busy}>{busy?'Enviando pedido...':review?'Confirmar pedido simulado':'Revisar compra'}</Button></aside></form></div>
}
