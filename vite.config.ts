import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()], base: process.env.VITE_BASE_PATH || '/operumdata-crm/', build:{rollupOptions:{output:{manualChunks:{react:['react','react-dom'],supabase:['@supabase/supabase-js'],csv:['papaparse']}}}} });
