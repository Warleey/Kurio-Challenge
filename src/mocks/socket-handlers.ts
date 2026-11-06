import {ws} from 'msw';
import {toSocketIo} from '@mswjs/socket.io-binding';
import type {NftUpdatedPayload,OrderUpdatedPayload} from '../lib/socket';

const socketUrl='http://localhost:5173/socket.io/?*';
export const socketLink=ws.link(socketUrl);

type Client=ReturnType<typeof toSocketIo>['client'];
const clients=new Set<Client>();

export const socketIoHandler=socketLink.addEventListener('connection',(connection)=>{
  const {client}=toSocketIo(connection);
  clients.add(client);
  connection.client.addEventListener('close',()=>clients.delete(client));
  client.on('__test:nft.updated',(_, payload:NftUpdatedPayload)=>{broadcast('nft.updated',payload);});
  client.on('__test:order.updated',(_, payload:OrderUpdatedPayload)=>{broadcast('order.updated',payload);});
});

export function broadcast(event:string,payload:unknown){
  for(const client of clients)client.emit(event,payload);
}
export function broadcastNftUpdated(payload:NftUpdatedPayload){broadcast('nft.updated',payload);}
export function broadcastOrderUpdated(payload:OrderUpdatedPayload){broadcast('order.updated',payload);}
