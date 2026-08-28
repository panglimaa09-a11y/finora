import { defineConfig } from 'vite'

export default defineConfig({
  // Dukung prefix lama (VITE_*) maupun nama baru (SUPABASE_*) yang dipakai
  // di environment Vercel/Supabase, sehingga env apa pun terbaca oleh
  // import.meta.env di dalam build.
  envPrefix: ['VITE_', 'SUPABASE_'],
})
