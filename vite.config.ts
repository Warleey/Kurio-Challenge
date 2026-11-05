import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const SERVER='http://localhost:3001';
export default defineConfig({plugins:[react(),tailwindcss()],server:{host:'0.0.0.0',allowedHosts:true,proxy:{'/api':{target:SERVER,changeOrigin:true},'/socket.io':{target:SERVER,changeOrigin:true,ws:true}}}});
