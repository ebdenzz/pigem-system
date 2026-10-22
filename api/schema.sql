-- ================================================================================
-- PIGEM INTERNET SERVICE APPLICATION SYSTEM - CLEAN DATABASE RESET SCHEMA
-- Target Database : Supabase PostgreSQL (Project: wuunqfxyejxwrawtjdrf)
-- Instructions    : Open Supabase SQL Editor -> Paste -> Press Ctrl+A (Select All) -> Click RUN
-- ================================================================================

-- 1. DROP EXISTING TABLES & LEGACY OBJECTS
DROP TABLE IF EXISTS public.system_logs CASCADE;
DROP TABLE IF EXISTS public.login_history CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.corrections CASCADE;
DROP TABLE IF EXISTS public.screenings CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.agent_links CASCADE;
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.website_content CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.activity CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. CREATE FRESH PRODUCTION TABLES (12 TABLES)

-- Table 1: USERS
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'manager', 'agent', 'customer')),
  active BOOLEAN NOT NULL DEFAULT true,
  activated BOOLEAN NOT NULL DEFAULT true,
  activation_code TEXT,
  reset_code TEXT,
  avatar_url TEXT,
  intro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: LOGIN HISTORY
CREATE TABLE public.login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  role TEXT,
  action TEXT NOT NULL DEFAULT 'login',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 3: AGENT LINKS
CREATE TABLE public.agent_links (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  link_code TEXT,
  agent_id TEXT,
  agent_email TEXT,
  agent_name TEXT,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 4: PLANS
CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  speed INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  tag TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Table 5: WEBSITE CONTENT
CREATE TABLE public.website_content (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 6: SYSTEM SETTINGS
CREATE TABLE public.system_settings (
  id TEXT PRIMARY KEY,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 7: APPLICATIONS
CREATE TABLE public.applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ref_no TEXT UNIQUE NOT NULL,
  reference_no TEXT,
  customer_id TEXT,
  agent_id TEXT,
  agent_link_code TEXT,
  assigned_agent TEXT,
  plan TEXT,
  plan_id TEXT,
  plan_name TEXT,
  first_name TEXT,
  middle_name TEXT DEFAULT 'N/A',
  last_name TEXT,
  full_name TEXT NOT NULL,
  birth_date TEXT,
  phone TEXT NOT NULL,
  phone_alt TEXT,
  email TEXT NOT NULL,
  house_no TEXT,
  house_suffix TEXT,
  unit_no TEXT,
  unit_type TEXT DEFAULT 'Residential',
  floor_no TEXT,
  building_name TEXT DEFAULT 'N/A',
  street TEXT,
  subdivision TEXT DEFAULT 'N/A',
  barangay TEXT,
  city TEXT,
  province TEXT,
  landmark TEXT,
  address_line TEXT,
  lat DOUBLE PRECISION DEFAULT 14.3294,
  lng DOUBLE PRECISION DEFAULT 120.9367,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  id_front_path TEXT,
  id_back_path TEXT,
  id_image_url TEXT,
  remarks TEXT,
  agree_tu BOOLEAN DEFAULT false,
  original_copy JSONB,
  original_submission JSONB,
  corrected_copy JSONB,
  has_correction BOOLEAN DEFAULT false,
  screening JSONB DEFAULT '{}'::jsonb,
  ai_result JSONB,
  ai_log JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Pending Review'
    CHECK (status IN ('Pending Review', 'Under Agent Review', 'Needs Correction', 'Approved', 'Rejected', 'Processing', 'Submitted to Provider')),
  correction_note TEXT,
  agent_remarks TEXT,
  provider_ref TEXT,
  provider_remarks TEXT,
  customer_instruction TEXT,
  encoded BOOLEAN DEFAULT false,
  encoded_proof TEXT,
  encoding_proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 8: DOCUMENTS
CREATE TABLE public.documents (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT,
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'original',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 9: SCREENINGS
CREATE TABLE public.screenings (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT,
  quality JSONB,
  ocr JSONB,
  comparisons JSONB,
  ai_remark TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 10: CORRECTIONS
CREATE TABLE public.corrections (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT,
  agent_id TEXT,
  issue_note TEXT NOT NULL,
  customer_response JSONB,
  status TEXT NOT NULL DEFAULT 'Pending Customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 11: NOTIFICATIONS
CREATE TABLE public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  role TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 12: SYSTEM LOGS
CREATE TABLE public.system_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_email TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ROW-LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on login_history" ON public.login_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on agent_links" ON public.agent_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on plans" ON public.plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on website_content" ON public.website_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on applications" ON public.applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on screenings" ON public.screenings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on corrections" ON public.corrections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_logs" ON public.system_logs FOR ALL USING (true) WITH CHECK (true);

-- 4. STORAGE BUCKETS CONFIGURATION
INSERT INTO storage.buckets (id, name, public)
VALUES ('website-assets', 'website-assets', true), ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public access to website-assets" ON storage.objects;
CREATE POLICY "Allow public access to website-assets"
ON storage.objects FOR ALL
USING (bucket_id = 'website-assets')
WITH CHECK (bucket_id = 'website-assets');

DROP POLICY IF EXISTS "Allow access to documents" ON storage.objects;
CREATE POLICY "Allow access to documents"
ON storage.objects FOR ALL
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 5. INITIAL CLEAN PRODUCTION SEED DATA (ZERO DEMO ACCOUNTS)

-- A. Official Red Fiber Plans
INSERT INTO public.plans (id, name, speed, price, tag, featured, active) VALUES
  ('1000', 'Plan 1000', 100, 1000, 'Fiber for your home', false, true),
  ('1400', 'Plan 1400', 300, 1400, 'Most Chosen', true, true),
  ('1900', 'Plan 1900', 500, 1900, 'Power Users & Heavy Streaming', false, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, speed = EXCLUDED.speed, price = EXCLUDED.price,
  tag = EXCLUDED.tag, featured = EXCLUDED.featured, active = EXCLUDED.active;

-- B. Default System Settings
INSERT INTO public.system_settings (id, ai_enabled, maintenance_mode, maintenance_message) VALUES
  ('main', true, false, '')
ON CONFLICT (id) DO UPDATE SET
  ai_enabled = EXCLUDED.ai_enabled, maintenance_mode = EXCLUDED.maintenance_mode;

-- C. Default Website CMS Data
INSERT INTO public.website_content (id, data) VALUES
  ('main', '{"logo_image": "logo.png", "area_text": "Available in select Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu areas.", "client_images": ["Clients/client-infus8.png", "Clients/client-radius.png", "Clients/client-maxcyc.png"], "hero_slides": [{"image": "Banners/home-banner-1.png", "title": "Pure Fiber Internet for Your Home", "desc": "Fast, reliable, and unlimited Red Fiber broadband without lock-in."}, {"image": "Banners/home-banner-2.png", "title": "Seamless Streaming & Gaming", "desc": "Low latency fiber connectivity optimized for modern smart homes."}, {"image": "Banners/home-banner-3.png", "title": "Quick Professional Installation", "desc": "Same-week dispatch and dedicated fiber facility validation in Cavite."}]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  data = EXCLUDED.data;

-- Return confirmation status
SELECT 'PIGEM database schema initialized successfully.' AS status;
