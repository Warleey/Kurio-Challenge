export type NFT={id:string;name:string;price:string;image:string;category:string;network:string;edition:string;stock:number;version:number;description:string};
export type CartItem={id:string;quantity:number};
export type Quote={lines:{id:string;name:string;image:string;quantity:number;price:string;total:string}[];subtotal:string;discount:string;fee:string;total:string;coupon:string|null;version:string};
export type Order={id:string;status:'pending'|'confirmed'|'declined';transaction:string;wallet:string;network:string;quote:Quote;createdAt:string};
export const nfts:NFT[]=[
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
{id:'sunny-beat',name:'Sunny Beat #240',price:'0.69',image:'/nfts/golden.png',category:'Música',network:'Polygon',edition:'ABERTA',stock:21,version:1,description:'Som, cor e cultura digital em uma coleção.'}];
const SCALE=1000n;
export const fromEth=(s:string)=>{const [i,f='']=s.split('.');return BigInt(i)*SCALE+BigInt((f+'000').slice(0,3))};
export const eth=(n:bigint)=>`${n/SCALE}.${(n%SCALE).toString().padStart(3,'0')}`;
export const pretty=(s:string)=>`${Number(s).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:3})} ETH`;
