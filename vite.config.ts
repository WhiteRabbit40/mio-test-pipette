
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Aumentiamo il limite del warning a 1000kB (1MB) dato che jsPDF è pesante
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Creiamo dei "chunk" manuali per separare le librerie pesanti
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Raggruppa jsPDF e le sue dipendenze in un chunk separato chiamato 'vendor-pdf'
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            // Tutto il resto delle librerie in 'vendor'
            return 'vendor';
          }
        },
      },
    },
  },
});
