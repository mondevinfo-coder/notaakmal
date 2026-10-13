# Sistem Nota Akmal (React + PostgreSQL Supabase)

Sistem pengurusan nota dengan sokongan menampal imej daripada papan keratan (*paste clipboard image*), dibina untuk hosting terus di **Cloudflare Pages**.

## 📌 Cara Menggunakan:

### 1. Persediaan Pangkalan Data Supabase (PostgreSQL)
1. Buka [Supabase](https://supabase.com) dan cipta projek baru.
2. Masuk ke **SQL Editor** dan salin kandungan fail `supabase_schema.sql`.
3. Tekan **Run**. Akaun `akmal` dan jadual `notes` serta `users` akan dicipta serta-merta.

### 2. Jalankan Secara Lokal:
```bash
npm install
npm run dev
```

### 3. Deploy ke Cloudflare Pages:
1. Hubungkan repository GitHub ke **Cloudflare Pages**.
2. Konfigurasi build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. Siap! Buka laman web anda di subdomain Cloudflare Pages.
