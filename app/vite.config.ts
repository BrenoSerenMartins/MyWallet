import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{const env=loadEnv(mode,'..','');return {plugins:[react()],server:{port:5173,proxy:{'/v1':'http://127.0.0.1:8083','/health':'http://127.0.0.1:8083','/ready':'http://127.0.0.1:8083'}},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(env.SUPABASE_URL??process.env.SUPABASE_URL??''),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY??process.env.SUPABASE_PUBLISHABLE_KEY??'')}};});
