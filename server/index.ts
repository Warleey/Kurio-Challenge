import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {createHash} from 'node:crypto';

const app=express();
app.use(express.json());

// Types
type NFT={id:string;name:string;price:string;image:string;category:string;network:string;edition:string;stock:number;version:number;description:string};
type CartItem={id:string;quantity:number};
type QuoteLine={id:string;name:string;image:string;quantity:number;price:string;total:string};
type Quote={lines:QuoteLine[];subtotal:string;discount:string;fee:string;total:string;coupon:string|null;version:string};
type Order={id:string;status:'pending'|'confirmed'|'declined';transaction:string;wallet:string;network:string;quote:Quote;createdAt:string};
type Wallet={id:string;name:string;address:string;network:string;profileName?:string;email?:string;ens?:string;secondary?:boolean;alias?:string;walletType?:string};
type User={id:string;email:string;name:string;username?:string;ens?:string;walletAlias?:string;avatar?:string;passwordHash:string;favorites:string[];wallets:Wallet[]};
type DB={users:User[];session:Record<string,string>;products:NFT[];carts:Record<string,CartItem[]>;orders:Order[];keys:Record<string,{orderId:string;body:string}>};

// ETH math
const SCALE=1000n;
const fromEth=(s:string)=>{const [i,f='']=s.split('.');return BigInt(i)*SCALE+BigInt((f+'000').slice(0,3))};
const eth=(n:bigint)=>`${n/SCALE}.${(n%SCALE).toString().padStart(3,'0')}`;

// Fixtures
const ALICE:User={id:'user-alice-0000-0000-0000-000000000001',name:'Alice Collector',email:'alice@kurio.test',username:'alice',passwordHash:'0771382e88bb08402547cd4bfd0f3a7fc742e9e27fea8889db6207ee23b9c82e',favorites:['emerald-ape','sage-nomad'],wallets:[{id:'wallet-alice-0001',name:'Carteira Principal',alias:'Principal',address:'0xALICE000000000000000000000000000000000001',network:'Ethereum',profileName:'Alice',email:'alice@kurio.test',walletType:'MetaMask'}]};
const BOB:User={id:'user-bob-00000-0000-0000-000000000002',name:'Bob Trader',email:'bob@kurio.test',username:'bob',passwordHash:'550c7a6d0859d0773541dd478bd49214188b9358549d3519ea542442f86e079c',favorites:['golden-beat','ivory-baron'],wallets:[{id:'wallet-bob-0001',name:'Carteira Bob',alias:'Principal',address:'0xBOB0000000000000000000000000000000000002',network:'Polygon',profileName:'Bob',email:'bob@kurio.test',walletType:'WalletConnect'}]};
const NFTS:NFT[]=[
  {id:'emerald-ape',name:'Emerald Ape #042',price:'1.19',image:'/nfts/emerald-promo.png',category:'Arte digital',network:'Ethereum',edition:'1/50',stock:12,version:1,description:'Um colecionável digital da coleção Kurio Editions, com arte desbloqueável e acesso para colecionadores.'},
  {id:'sage-nomad',name:'Sage Nomad #089',price:'1.69',image:'/nfts/sage.png',category:'Fotografia',network:'Polygon',edition:'1/10',stock:9,version:1,description:'Um viajante digital com olhar curioso e uma história para descobrir.'},
  {id:'neon-vessel',name:'Neon Vessel #552',price:'1.99',image:'/nfts/ivory.png',category:'Arte 3D',network:'Ethereum',edition:'ABERTA',stock:32,version:1,description:'Um estudo sobre identidade em um mundo digital sem fronteiras.'},
  {id:'cosmic-bloom',name:'Cosmic Bloom #118',price:'1.29',image:'/nfts/sage.png',category:'Colecionáveis',network:'Solana',edition:'1/50',stock:15,version:1,description:'Onde a cultura digital encontra uma nova forma de expressão.'},
  {id:'violet-nomad',name:'Violet Nomad #314',price:'1.39',image:'/nfts/sage.png',category:'Arte digital',network:'Ethereum',edition:'1/50',stock:16,version:1,description:'Um retrato marcante de uma coleção limitada.'},
  {id:'ivory-baron',name:'Ivory Baron #088',price:'1.79',image:'/nfts/ivory.png',category:'Arte 3D',network:'Polygon',edition:'1/10',stock:18,version:1,description:'A elegância ganha novas formas nas coleções Kurio.'},
  {id:'golden-beat',name:'Golden Beat #207',price:'0.99',image:'/nfts/golden.png',category:'Música',network:'Solana',edition:'ABERTA',stock:24,version:1,description:'O ritmo de uma geração de criadores digitais.'},
  {id:'golden-signal',name:'Golden Signal #160',price:'0.39',image:'/nfts/golden.png',category:'Colecionáveis',network:'Ethereum',edition:'1/50',stock:40,version:1,description:'Um sinal para a próxima geração de arte.'},
  {id:'urban-nomad',name:'Urban Nomad #401',price:'1.59',image:'/nfts/emerald-promo.png',category:'Jogos',network:'Polygon',edition:'1/10',stock:17,version:1,description:'A cidade digital ganha um novo protagonista.'},
  {id:'orchid-ape',name:'Orchid Ape #277',price:'0.89',image:'/nfts/sage.png',category:'Arte digital',network:'Solana',edition:'1/50',stock:13,version:1,description:'Uma obra para descobrir e colecionar.'},
  {id:'night-baron',name:'Night Baron #106',price:'1.49',image:'/nfts/ivory.png',category:'Fotografia',network:'Ethereum',edition:'1/10',stock:11,version:1,description:'Um retrato de um mundo em transformação.'},
  {id:'sunny-beat',name:'Sunny Beat #240',price:'0.69',image:'/nfts/golden.png',category:'Música',network:'Polygon',edition:'ABERTA',stock:21,version:1,description:'Som, cor e cultura digital em uma coleção.'},
];

// In-memory DB (reset a cada restart)
const initDb=():DB=>({
  users:[structuredClone(ALICE),structuredClone(BOB)],
  session:{}, // token → userId
  products:structuredClone(NFTS),
  carts:{guest:[],'user-alice-0000-0000-0000-000000000001':[{id:'emerald-ape',quantity:1}],'user-bob-00000-0000-0000-000000000002':[{id:'golden-beat',quantity:2},{id:'ivory-baron',quantity:1}]},
  orders:[],
  keys:{},
});
let db=initDb();

// Helpers
const sha256=(s:string)=>createHash('sha256').update(s).digest('hex');
const uid=()=>crypto.randomUUID();
const err=(res:express.Response,msg:string,status:number)=>res.status(status).json({message:msg});
const getToken=(req:express.Request)=>req.headers.authorization?.replace('Bearer ','')??'';
const userByToken=(req:express.Request)=>{const id=db.session[getToken(req)];return id?db.users.find(u=>u.id===id)??null:null};
const who=(req:express.Request)=>userByToken(req)?.id??'guest';
const cart=(req:express.Request)=>db.carts[who(req)]??[];
const buildQuote=(req:express.Request,coupon:string|null):Quote=>{
  const lines=cart(req).map(c=>{const n=db.products.find(p=>p.id===c.id)!;return {id:n.id,name:n.name,image:n.image,quantity:c.quantity,price:n.price,total:eth(fromEth(n.price)*BigInt(c.quantity))};});
  const subtotal=lines.reduce((s,l)=>s+fromEth(l.total),0n),discount=coupon==='KURIO10'?subtotal/10n:0n,fee=lines.length?16n:0n;
  return {lines,subtotal:eth(subtotal),discount:eth(discount),fee:eth(fee),total:eth(subtotal-discount+fee),coupon,version:lines.map(l=>`${l.id}:${db.products.find(p=>p.id===l.id)!.version}:${l.quantity}`).join('|')+`:${coupon??''}`};
};

// Socket.IO
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:'*'},path:'/socket.io'});
const broadcast=(event:string,payload:unknown)=>io.emit(event,payload);

io.on('connection',(socket)=>{
  socket.on('__test:nft.updated',(payload)=>broadcast('nft.updated',payload));
  socket.on('__test:order.updated',(payload)=>broadcast('order.updated',payload));
});

// Auth middleware
const requireAuth=(req:express.Request,res:express.Response,next:express.NextFunction)=>{
  if(!userByToken(req))return void err(res,'Faça login',401);
  next();
};

// Routes
app.get('/api/nfts',(req,res)=>{
  const p=req.query as Record<string,string>;
  let list=db.products.filter(n=>
    n.name.toLowerCase().includes((p.q??'').toLowerCase())&&
    (!p.category||n.category===p.category)&&
    (!p.network||n.network===p.network)&&
    Number(n.price)>=Number(p.min??'0.02')&&
    Number(n.price)<=Number(p.max??'12.30')
  );
  if(p.sort==='price-asc')list.sort((a,b)=>Number(a.price)-Number(b.price));
  if(p.sort==='price-desc')list.sort((a,b)=>Number(b.price)-Number(a.price));
  const page=Math.max(1,Number(p.page??1));
  res.json({items:list.slice((page-1)*8,page*8),total:list.length,pages:Math.max(1,Math.ceil(list.length/8))});
});

app.get('/api/nfts/:id',(req,res)=>{
  const n=db.products.find(p=>p.id===req.params.id);
  n?res.json(n):err(res,'NFT não encontrado',404);
});

app.get('/api/session',(req,res)=>{
  const u=userByToken(req);
  res.json(u?{id:u.id,name:u.name,email:u.email,username:u.username,ens:u.ens,walletAlias:u.walletAlias,avatar:u.avatar}:null);
});

app.post('/api/register',async(req,res)=>{
  const {name,email,password}=req.body as {name:string;email:string;password:string};
  if(!name||!email?.includes('@')||password?.length<6)return void err(res,'Informe nome, e-mail válido e senha com 6 caracteres',400);
  if(db.users.some(u=>u.email===email.toLowerCase()))return void err(res,'Este e-mail já está cadastrado',409);
  const id=uid();
  db.users.push({id,name,email:email.toLowerCase(),passwordHash:sha256(password),favorites:[],wallets:[]});
  db.carts[id]=db.carts.guest??[];
  db.carts.guest=[];
  const token=uid();
  db.session[token]=id;
  res.setHeader('Set-Cookie',`kurio-token=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.status(201).json({id,name,email});
});

app.post('/api/login',async(req,res)=>{
  const {email,password}=req.body as {email:string;password:string};
  const u=db.users.find(u=>u.email===email?.toLowerCase());
  if(!u||u.passwordHash!==sha256(password))return void err(res,'E-mail ou senha inválidos',401);
  const items=db.carts[u.id]??[];
  for(const item of db.carts.guest??[]){const ex=items.find(x=>x.id===item.id);if(ex)ex.quantity=Math.min(99,ex.quantity+item.quantity);else items.push(item);}
  db.carts[u.id]=items;db.carts.guest=[];
  const token=uid();
  db.session[token]=u.id;
  res.setHeader('Set-Cookie',`kurio-token=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.json({id:u.id,email:u.email,name:u.name});
});

app.post('/api/logout',(req,res)=>{
  delete db.session[getToken(req)];
  res.clearCookie('kurio-token');
  res.json({ok:true});
});

app.get('/api/cart',(req,res)=>res.json(cart(req)));

app.put('/api/cart/:id',(req,res)=>{
  const n=db.products.find(p=>p.id===req.params.id);
  if(!n)return void err(res,'NFT não encontrado',404);
  const {quantity}=req.body as {quantity:number};
  if(!Number.isInteger(quantity)||quantity<0)return void err(res,'Quantidade inválida',400);
  if(quantity>n.stock)return void err(res,`Somente ${n.stock} edições disponíveis`,409);
  const items=cart(req).filter(c=>c.id!==n.id);
  if(quantity)items.push({id:n.id,quantity});
  db.carts[who(req)]=items;
  res.json(items);
});

app.get('/api/quote',(req,res)=>{
  const coupon=(req.query.coupon as string|undefined)??null;
  if(coupon&&coupon!=='KURIO10')return void err(res,'Cupom inválido ou expirado',422);
  res.json(buildQuote(req,coupon));
});

app.get('/api/favorites',requireAuth,(req,res)=>res.json(userByToken(req)!.favorites));

app.put('/api/favorites/:id',requireAuth,(req,res)=>{
  const u=userByToken(req)!,id=req.params.id;
  u.favorites=u.favorites.includes(id)?u.favorites.filter(x=>x!==id):[...u.favorites,id];
  res.json(u.favorites);
});

app.get('/api/profile',requireAuth,(req,res)=>{
  const u=userByToken(req)!;
  res.json({id:u.id,name:u.name,email:u.email,username:u.username,ens:u.ens,walletAlias:u.walletAlias,avatar:u.avatar});
});

app.patch('/api/profile',requireAuth,async(req,res)=>{
  const u=userByToken(req)!;
  const {name,username,email,ens,walletAlias,avatar}=req.body as {name:string;username:string;email:string;ens?:string;walletAlias?:string;avatar?:string};
  if(!name?.trim()||!username?.trim()||!email?.includes('@'))return void err(res,'Informe nome, usuário e e-mail válido',400);
  if(db.users.some(x=>x.id!==u.id&&x.email===email.toLowerCase()))return void err(res,'E-mail já cadastrado',409);
  Object.assign(u,{name:name.trim(),username:username.trim(),email:email.toLowerCase(),ens,walletAlias,avatar});
  res.json({id:u.id,name:u.name,username:u.username,email:u.email,ens:u.ens,walletAlias:u.walletAlias,avatar:u.avatar});
});

app.post('/api/profile/password',requireAuth,async(req,res)=>{
  const u=userByToken(req)!;
  const {currentPassword,newPassword}=req.body as {currentPassword:string;newPassword:string};
  if(u.passwordHash!==sha256(currentPassword))return void err(res,'Senha atual incorreta',400);
  if(newPassword?.length<6)return void err(res,'A nova senha deve ter ao menos 6 caracteres',400);
  u.passwordHash=sha256(newPassword);
  res.json({ok:true});
});

app.get('/api/wallets',requireAuth,(req,res)=>res.json(userByToken(req)!.wallets));

app.post('/api/wallets',requireAuth,(req,res)=>{
  const u=userByToken(req)!;
  const d=req.body as Wallet;
  if(!d.name?.trim()||!d.network||d.address?.length<8)return void err(res,'Informe nome, rede e endereço válido',400);
  if(u.wallets.some(w=>w.address===d.address))return void err(res,'Carteira já cadastrada',409);
  if(d.secondary&&u.wallets.some(w=>w.secondary))return void err(res,'Já existe uma carteira secundária',409);
  u.wallets.push({...d,id:uid()});
  res.status(201).json(u.wallets);
});

app.patch('/api/wallets/:id',requireAuth,(req,res)=>{
  const u=userByToken(req)!;
  const w=u.wallets.find(w=>w.id===req.params.id);
  if(!w)return void err(res,'Carteira não encontrada',404);
  const d=req.body as Wallet;
  if(!d.name?.trim()||!d.network||d.address?.length<8)return void err(res,'Informe nome, rede e endereço válido',400);
  if(u.wallets.some(x=>x.id!==w.id&&x.address===d.address))return void err(res,'Endereço já cadastrado',409);
  Object.assign(w,d);
  res.json(w);
});

app.get('/api/orders/:id',requireAuth,(req,res)=>{
  const u=userByToken(req)!;
  const order=db.orders.find(o=>o.id===req.params.id&&o.wallet.startsWith(u.id+':'));
  order?res.json(order):err(res,'Pedido não encontrado',404);
});

app.post('/api/orders',requireAuth,(req,res)=>{
  const u=userByToken(req)!;
  const d=req.body as {key:string;version:string;coupon:string|null;wallet:string;network:string};
  if(!d.key)return void err(res,'Chave de idempotência obrigatória',400);
  const body=JSON.stringify({version:d.version,coupon:d.coupon,wallet:d.wallet,network:d.network});
  const old=db.keys[d.key];
  if(old){if(old.body!==body)return void err(res,'Chave reutilizada para outra compra',409);return void res.json(db.orders.find(o=>o.id===old.orderId));}
  const fresh=buildQuote(req,d.coupon);
  if(fresh.version!==d.version)return void err(res,'O preço ou a disponibilidade mudou. Revise sua compra.',409);
  if(!fresh.lines.length)return void err(res,'Carrinho vazio',400);
  const id=uid();
  const order:Order={id,status:'pending',transaction:'0x'+id.replaceAll('-','').slice(0,16).toUpperCase(),wallet:`${u.id}:${d.wallet}`,network:d.network,quote:fresh,createdAt:new Date().toISOString()};
  db.orders.unshift(order);db.keys[d.key]={orderId:id,body};db.carts[u.id]=[];
  setTimeout(()=>{
    const o=db.orders.find(x=>x.id===id);
    if(!o||o.status!=='pending')return;
    o.status=Math.random()<0.85?'confirmed':'declined';
    broadcast('order.updated',{orderId:id,version:2,status:o.status});
  },3000);
  res.status(201).json(order);
});

app.post('/api/demo/reset',(_req,res)=>{db=initDb();res.json({ok:true});});

// Start
const PORT=Number(process.env.PORT??3001);
httpServer.listen(PORT,()=>console.log(`[kurio-server] http://localhost:${PORT}`));
