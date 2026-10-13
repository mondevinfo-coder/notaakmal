-- ====================================================
-- SKRIP POSTGRESQL UNTUK SISTEM NOTA (SUPABASE)
-- Jalankan skrip ini dalam Supabase SQL Editor
-- ====================================================

-- 1. Cipta Jadual Users (Custom Auth terus dalam Postgres)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Akmal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Cipta Jadual Notes (Menyokong teks & gambar base64 yang di-paste)
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Menyimpan HTML & gambar data:image/png;base64
    category TEXT DEFAULT 'Umum',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Aktifkan Row Level Security (Atau benarkan akses direct postgrest)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Polisi akses terus (Direct Access melalui PostgREST/Anon Key)
CREATE POLICY "Akses penuh users anon" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses penuh notes anon" ON public.notes FOR ALL USING (true) WITH CHECK (true);

-- 4. Masukkan akaun Akmal (Username: akmal, Password: password)
-- Menyokong semakan teks atau hash
INSERT INTO public.users (username, password_hash, name)
VALUES ('akmal', 'password', 'Akmal')
ON CONFLICT (username) DO UPDATE 
SET password_hash = 'password';

-- 5. Indeks carian pantas
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at DESC);
