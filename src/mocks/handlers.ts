import {http,HttpResponse} from 'msw';
import {nfts,fromEth,eth,type CartItem,type NFT,type Order,type Quote} from '../lib/domain';
import {broadcastOrderUpdated} from './socket-handlers';
import {jitter,maybeFail,getScenario,shouldTimeoutOrder} from './scenarios';
import {ALICE,BOB,ALICE_CART,BOB_CART} from './fixtures';
const base='/api';
type User={id:string;email:string;name:string;username?:string;ens?:string;walletAlias?:string;avatar?:string;passwordHash:string;favorites:string[];wallets:{id:string;name:string;address:string;network:string;profileName?:string;email?:string;ens?:string;secondary?:boolean;alias?:string;walletType?:string}[]};
type DB={users:User[];session:string|null;products:NFT[];carts:Record<string,CartItem[]>;orders:Order[];keys:Record<string,{orderId:string;body:string}>};
const init=():DB=>({users:[ALICE as User,BOB as User],session:null,products:nfts,carts:{guest:[],[ALICE.id]:ALICE_CART,[BOB.id]:BOB_CART},orders:[],keys:{}});
let db:DB;
try{db=JSON.parse(localStorage.getItem('kurio-db-v1')||'null')||init()}catch{db=init()}
const save=()=>localStorage.setItem('kurio-db-v1',JSON.stringify(db));
const user=()=>db.users.find(u=>u.id===db.session);
const who=()=>user()?.id||'guest';
const err=(message:string,status:number)=>HttpResponse.json({message},{status});
const auth=()=>user()||null;
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const cart=()=>db.carts[who()]||[];
const quote=(coupon:string|null):Quote=>{
 const lines=cart().map(c=>{const n=db.products.find(p=>p.id===c.id)!;return {id:n.id,name:n.name,image:n.image,quantity:c.quantity,price:n.price,total:eth(fromEth(n.price)*BigInt(c.quantity))}});
 const subtotal=lines.reduce((sum,l)=>sum+fromEth(l.total),0n), discount=coupon==='KURIO10'?subtotal/10n:0n,fee=lines.length?16n:0n;
 return {lines,subtotal:eth(subtotal),discount:eth(discount),fee:eth(fee),total:eth(subtotal-discount+fee),coupon,version:lines.map(l=>`${l.id}:${db.products.find(p=>p.id===l.id)!.version}:${l.quantity}`).join('|')+`:${coupon||''}`};
};
export const handlers=[
 http.get(`${base}/nfts`,async({request})=>{await jitter(220);const fail=maybeFail();if(fail)return fail;const p=new URL(request.url).searchParams;let list=db.products.filter(n=>n.name.toLowerCase().includes((p.get('q')||'').toLowerCase())&&(!p.get('category')||n.category===p.get('category'))&&(!p.get('network')||n.network===p.get('network'))&&Number(n.price)>=Number(p.get('min')||'0.02')&&Number(n.price)<=Number(p.get('max')||'12.30'));const order=p.get('sort');if(order==='price-asc')list.sort((a,b)=>Number(a.price)-Number(b.price));if(order==='price-desc')list.sort((a,b)=>Number(b.price)-Number(a.price));const page=Math.max(1,Number(p.get('page')||1));return HttpResponse.json({items:list.slice((page-1)*8,page*8),total:list.length,pages:Math.max(1,Math.ceil(list.length/8))})}),
 http.get(`${base}/nfts/:id`,async({params})=>{await jitter(120);const fail=maybeFail();if(fail)return fail;const n=db.products.find(p=>p.id===params.id);return n?HttpResponse.json(n):err('NFT não encontrado',404)}),
 http.get(`${base}/session`,()=>{if(getScenario()==='expired'){db.session=null;save();return HttpResponse.json({message:'Sessão expirada. Faça login novamente.'},{status:401})}return HttpResponse.json(auth()?{id:user()!.id,name:user()!.name,email:user()!.email,username:user()!.username,ens:user()!.ens,walletAlias:user()!.walletAlias,avatar:user()!.avatar}:null)}),
 http.post(`${base}/register`,async({request})=>{const d=await request.json() as {name:string;email:string;password:string};if(!d.name||!d.email.includes('@')||d.password.length<6)return err('Informe nome, e-mail válido e senha com 6 caracteres',400);if(db.users.some(u=>u.email===d.email.toLowerCase()))return err('Este e-mail já está cadastrado',409);const id=crypto.randomUUID();db.users.push({id,name:d.name,email:d.email.toLowerCase(),passwordHash:await hash(d.password),favorites:[],wallets:[]});db.session=id;const items:CartItem[]=[];for(const item of db.carts.guest||[]){const existing=items.find(x=>x.id===item.id);if(existing)existing.quantity=Math.min(99,existing.quantity+item.quantity);else items.push(item)}db.carts[id]=items;db.carts.guest=[];save();return HttpResponse.json({id,name:d.name,email:d.email},{status:201})}),
 http.post(`${base}/login`,async({request})=>{const d=await request.json() as {email:string;password:string};const u=db.users.find(u=>u.email===d.email.toLowerCase());if(!u||u.passwordHash!==await hash(d.password))return err('E-mail ou senha inválidos',401);db.session=u.id;const items=db.carts[u.id]||[];for(const item of db.carts.guest||[]){const existing=items.find(x=>x.id===item.id);if(existing)existing.quantity=Math.min(99,existing.quantity+item.quantity);else items.push(item)}db.carts[u.id]=items;db.carts.guest=[];save();return HttpResponse.json({id:u.id,email:u.email,name:u.name})}),
 http.post(`${base}/logout`,()=>{db.session=null;save();return HttpResponse.json({ok:true})}),
 http.get(`${base}/cart`,()=>HttpResponse.json([...cart()].sort((a,b)=>a.id.localeCompare(b.id)))),
 http.put(`${base}/cart/:id`,async({params,request})=>{const d=await request.json() as {quantity:number};const n=db.products.find(p=>p.id===params.id);if(!n)return err('NFT não encontrado',404);if(!Number.isInteger(d.quantity)||d.quantity<0)return err('Quantidade inválida',400);if(d.quantity>n.stock)return err(`Somente ${n.stock} edições disponíveis`,409);const items=cart().filter(c=>c.id!==n.id);if(d.quantity)items.push({id:n.id,quantity:d.quantity});db.carts[who()]=items;save();return HttpResponse.json([...items].sort((a,b)=>a.id.localeCompare(b.id)))}),
 http.get(`${base}/quote`,({request})=>{const coupon=new URL(request.url).searchParams.get('coupon');if(coupon&&coupon!=='KURIO10')return err('Cupom inválido ou expirado',422);return HttpResponse.json(quote(coupon))}),
 http.get(`${base}/favorites`,()=>user()?HttpResponse.json(user()!.favorites):err('Faça login',401)),
 http.put(`${base}/favorites/:id`,({params})=>{const u=user();if(!u)return err('Faça login',401);const id=String(params.id);u.favorites=u.favorites.includes(id)?u.favorites.filter(x=>x!==id):[...u.favorites,id];save();return HttpResponse.json(u.favorites)}),
 http.get(`${base}/profile`,()=>auth()?HttpResponse.json({id:user()!.id,name:user()!.name,email:user()!.email,username:user()!.username,ens:user()!.ens,walletAlias:user()!.walletAlias,avatar:user()!.avatar}):err('Faça login',401)),
 http.patch(`${base}/profile`,async({request})=>{const u=user();if(!u)return err('Faça login',401);const d=await request.json() as {name:string;username:string;email:string;ens?:string;walletAlias?:string;avatar?:string};if(!d.name?.trim()||!d.username?.trim()||!d.email?.includes('@'))return err('Informe nome, usuário e e-mail válido',400);if(db.users.some(x=>x.id!==u.id&&x.email===d.email.toLowerCase()))return err('E-mail já cadastrado',409);u.name=d.name.trim();u.username=d.username.trim();u.email=d.email.toLowerCase();u.ens=d.ens;u.walletAlias=d.walletAlias;u.avatar=d.avatar;save();return HttpResponse.json({id:u.id,name:u.name,username:u.username,email:u.email,ens:u.ens,walletAlias:u.walletAlias,avatar:u.avatar})}),
 http.post(`${base}/profile/password`,async({request})=>{const u=user();if(!u)return err('Faça login',401);const d=await request.json() as {currentPassword:string;newPassword:string};if(u.passwordHash!==await hash(d.currentPassword))return err('Senha atual incorreta',400);if(d.newPassword?.length<6)return err('A nova senha deve ter ao menos 6 caracteres',400);u.passwordHash=await hash(d.newPassword);save();return HttpResponse.json({ok:true})}),
 http.get(`${base}/wallets`,()=>auth()?HttpResponse.json(user()!.wallets):err('Faça login',401)),
 http.post(`${base}/wallets`,async({request})=>{const u=user();if(!u)return err('Faça login',401);const d=await request.json() as {name:string;address:string;network:string;profileName?:string;email?:string;ens?:string;secondary?:boolean};if(!d.name?.trim()||!d.network||d.address?.length<8)return err('Informe nome, rede e endereço válido',400);if(u.wallets.some(w=>w.address===d.address))return err('Carteira já cadastrada',409);if(d.secondary&&u.wallets.some(w=>w.secondary))return err('Já existe uma carteira secundária',409);u.wallets.push({...d,id:crypto.randomUUID()});save();return HttpResponse.json(u.wallets,{status:201})}),
 http.patch(`${base}/wallets/:id`,async({params,request})=>{const u=user();if(!u)return err('Faça login',401);const w=u.wallets.find(w=>w.id===params.id);if(!w)return err('Carteira não encontrada',404);const d=await request.json() as {name:string;address:string;network:string;profileName?:string;email?:string;ens?:string;secondary?:boolean};if(!d.name?.trim()||!d.network||d.address?.length<8)return err('Informe nome, rede e endereço válido',400);if(u.wallets.some(x=>x.id!==w.id&&x.address===d.address))return err('Endereço já cadastrado',409);Object.assign(w,d);save();return HttpResponse.json(w)}),
 http.get(`${base}/orders/:id`,({params})=>{const u=user();if(!u)return err('Faça login',401);const order=db.orders.find(o=>o.id===params.id&&o.wallet.startsWith(u.id+':'));return order?HttpResponse.json(order):err('Pedido não encontrado',404)}),
 http.post(`${base}/orders`,async({request})=>{
  const u=user();if(!u)return err('Faça login antes de finalizar',401);
  const d=await request.json() as {key:string;version:string;coupon:string|null;wallet:string;network:string};
  const body=JSON.stringify({version:d.version,coupon:d.coupon,wallet:d.wallet,network:d.network});
  if(!d.key)return err('Chave de idempotência obrigatória',400);
  const old=db.keys[d.key];
  if(old){if(old.body!==body)return err('Chave reutilizada para outra compra',409);return HttpResponse.json(db.orders.find(o=>o.id===old.orderId))}
  const fresh=quote(d.coupon);
  if(fresh.version!==d.version)return err('O preço ou a disponibilidade mudou. Revise sua compra.',409);
  if(!fresh.lines.length)return err('Carrinho vazio',400);
  const id=crypto.randomUUID();
  const order:Order={id,status:'pending',transaction:'0x'+id.replaceAll('-','').slice(0,16).toUpperCase(),wallet:`${u.id}:${d.wallet}`,network:d.network,quote:fresh,createdAt:new Date().toISOString()};
  db.orders.unshift(order);db.keys[d.key]={orderId:id,body};db.carts[u.id]=[];save();
  setTimeout(()=>{const o=db.orders.find(x=>x.id===id);if(!o||o.status!=='pending')return;const finalStatus=Math.random()<0.85?'confirmed':'declined';o.status=finalStatus;save();broadcastOrderUpdated({orderId:id,version:2,status:finalStatus});},1500);
  if(shouldTimeoutOrder())await new Promise(r=>setTimeout(r,15000));
  return HttpResponse.json(order,{status:201});
 }),
 http.post(`${base}/demo/reset`,()=>{db=init();save();return HttpResponse.json({ok:true})}),
];
