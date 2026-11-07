-- ============================================================
-- PIGEM WEB-BASED INTERNET SERVICE APPLICATION SYSTEM
-- PostgreSQL Cloud Schema (Supabase - 14 Tables + 2 Buckets)
-- Note: Run the separate reset script first only when
--       performing a clean database re-initialization.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Automatic timestamp helper for updated_at columns
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. USER ACCOUNTS & ROLE IDENTITY GOVERNANCE
--    - Every user role (admin, manager, agent, customer) has a unique username
--    - Customers: @gmail.com accounts only
--    - Agents, Manager, Admin: Business accounts (non-Gmail)
--    - Single Admin Rule: Enforced via idx_users_single_admin
-- ============================================================
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL
    CHECK (username ~ '^[a-zA-Z0-9._]{3,30}$'),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('admin', 'manager', 'agent', 'customer')),
  active BOOLEAN NOT NULL DEFAULT true,
  activated BOOLEAN NOT NULL DEFAULT true,
  activation_code TEXT,
  reset_code TEXT,
  avatar_url TEXT,
  intro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_email_by_role CHECK (
    (role = 'customer' AND lower(email) LIKE '%@gmail.com')
    OR (role IN ('admin', 'manager', 'agent') AND email LIKE '%@%' AND lower(email) NOT LIKE '%@gmail.com')
  )
);

CREATE UNIQUE INDEX idx_users_username_lower
  ON public.users (lower(username));

CREATE UNIQUE INDEX idx_users_single_admin
  ON public.users ((role))
  WHERE role = 'admin';

CREATE INDEX idx_users_role ON public.users (role);

-- ============================================================
-- 2. FIBER SERVICE PLANS
-- ============================================================
CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  speed INTEGER NOT NULL CHECK (speed > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  tag TEXT DEFAULT 'Fiber for your home',
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- 3. GLOBAL SYSTEM SETTINGS (Screening & Maintenance Mode)
-- ============================================================
CREATE TABLE public.system_settings (
  id TEXT PRIMARY KEY,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================
-- 4. PUBLIC WEBSITE CMS CONTENT & ANNOUNCEMENTS
-- ============================================================
CREATE TABLE public.website_content (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_website_content_updated_at
  BEFORE UPDATE ON public.website_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================
-- 5. AGENT REFERRAL APPLICATION LINKS
-- ============================================================
CREATE TABLE public.agent_links (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  link_code TEXT,
  agent_id TEXT,
  agent_email TEXT,
  agent_name TEXT,
  note TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_links_agent_email ON public.agent_links (agent_email);

-- ============================================================
-- 6. CUSTOMER INTERNET SERVICE APPLICATIONS
-- ============================================================
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
  email TEXT NOT NULL CHECK (lower(email) LIKE '%@gmail.com'),
  house_no TEXT,
  house_suffix TEXT,
  unit_no TEXT,
  unit_type TEXT DEFAULT 'House',
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
  cropped_id_path TEXT,
  remarks TEXT,
  agree_tu BOOLEAN NOT NULL DEFAULT false,
  original_copy JSONB,
  original_submission JSONB,
  corrected_copy JSONB,
  has_correction BOOLEAN NOT NULL DEFAULT false,
  screening JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_result JSONB,
  ai_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Pending Review'
    CHECK (status IN (
      'Pending Review',
      'Under Agent Review',
      'Encoding',
      'Approved',
      'Rejected',
      'Needs Correction',
      'Processing',
      'Submitted to Provider'
    )),
  correction_note TEXT,
  agent_remarks TEXT,
  provider_ref TEXT,
  provider_remarks TEXT,
  customer_instruction TEXT,
  encoded BOOLEAN NOT NULL DEFAULT false,
  encoded_proof TEXT,
  encoding_proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_email ON public.applications (email);
CREATE INDEX idx_applications_status ON public.applications (status);
CREATE INDEX idx_applications_assigned_agent ON public.applications (assigned_agent);
CREATE INDEX idx_applications_created_at ON public.applications (created_at DESC);

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================
-- 7. SUBMITTED & CROPPED IDENTIFICATION DOCUMENTS
-- ============================================================
CREATE TABLE public.documents (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'original'
    CHECK (version IN ('original', 'cropped', 'corrected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_application_id ON public.documents (application_id);

-- ============================================================
-- 8. AI-ASSISTED REQUIREMENTS SCREENING RECORDS
-- ============================================================
CREATE TABLE public.screenings (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  quality JSONB,
  ocr JSONB,
  comparisons JSONB,
  ai_remark TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_screenings_application_id ON public.screenings (application_id);

-- ============================================================
-- 9. AGENT-CONFIRMED CUSTOMER CORRECTION RECORDS
-- ============================================================
CREATE TABLE public.corrections (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  agent_id TEXT,
  issue_note TEXT NOT NULL,
  customer_response JSONB,
  status TEXT NOT NULL DEFAULT 'Pending Customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_corrections_application_id ON public.corrections (application_id);

-- ============================================================
-- 10. PROVIDER ENCODING & VALIDATION UPDATES
-- ============================================================
CREATE TABLE public.provider_updates (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  recorded_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  provider_ref TEXT,
  provider_status TEXT NOT NULL,
  provider_remark TEXT,
  customer_instruction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_updates_application_id ON public.provider_updates (application_id);

-- ============================================================
-- 11. IN-SYSTEM PORTAL NOTIFICATIONS (Customer, Agent, Manager, Admin)
-- ============================================================
CREATE TABLE public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  role TEXT CHECK (role IS NULL OR role IN ('admin', 'manager', 'agent', 'customer')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_email ON public.notifications (email);
CREATE INDEX idx_notifications_role ON public.notifications (role);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);

-- ============================================================
-- 12. AUTHENTICATION & SESSION AUDIT HISTORY
-- ============================================================
CREATE TABLE public.login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  email TEXT,
  role TEXT,
  action TEXT NOT NULL DEFAULT 'login',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_history_created_at ON public.login_history (created_at DESC);

-- ============================================================
-- 13. TECHNICAL & OPERATIONAL ACTIVITY LOGS
-- ============================================================
CREATE TABLE public.system_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_username TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_logs_created_at ON public.system_logs (created_at DESC);

-- ============================================================
-- 14. ROLE-BASED PORTAL POP-UP GUIDES
-- ============================================================
CREATE TABLE public.popup_guides (
  id TEXT PRIMARY KEY,
  portal TEXT NOT NULL
    CHECK (portal IN ('public', 'apply', 'customer', 'agent', 'manager', 'admin')),
  audience_tone TEXT NOT NULL DEFAULT 'polite'
    CHECK (audience_tone IN ('polite', 'polite_simple', 'professional', 'technical')),
  title TEXT NOT NULL,
  intro TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  footer_note TEXT NOT NULL DEFAULT '',
  button_label TEXT NOT NULL DEFAULT 'Got It',
  auto_show BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_popup_guides_updated_at
  BEFORE UPDATE ON public.popup_guides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on plans" ON public.plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on website_content" ON public.website_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on agent_links" ON public.agent_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on applications" ON public.applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on screenings" ON public.screenings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on corrections" ON public.corrections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on provider_updates" ON public.provider_updates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on login_history" ON public.login_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_logs" ON public.system_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on popup_guides" ON public.popup_guides FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- CLOUD STORAGE BUCKETS (website-assets & documents)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('website-assets', 'website-assets', true),
  ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public access to website-assets"
  ON storage.objects FOR ALL
  USING (bucket_id = 'website-assets')
  WITH CHECK (bucket_id = 'website-assets');

CREATE POLICY "Allow access to documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- ============================================================
-- DEFAULT INITIAL SEED DATA
-- ============================================================
INSERT INTO public.plans (id, name, speed, price, tag, featured, active) VALUES
  ('1000', 'Plan 1000', 100, 1000.00, 'Fiber for your home', false, true),
  ('1400', 'Plan 1400', 300, 1400.00, 'Most Chosen', true, true),
  ('1900', 'Plan 1900', 500, 1900.00, 'Fiber for your home', false, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  speed = EXCLUDED.speed,
  price = EXCLUDED.price,
  tag = EXCLUDED.tag,
  featured = EXCLUDED.featured,
  active = EXCLUDED.active;

INSERT INTO public.system_settings (id, ai_enabled, maintenance_mode, maintenance_message)
VALUES ('main', true, false, '')
ON CONFLICT (id) DO UPDATE SET
  ai_enabled = EXCLUDED.ai_enabled,
  maintenance_mode = EXCLUDED.maintenance_mode;

INSERT INTO public.website_content (id, data)
VALUES (
  'main',
  '{"logo_image": "logo.png", "area_text": "Available in select Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu areas.", "client_images": ["Clients/client-infus8.png", "Clients/client-radius.png", "Clients/client-maxcyc.png"], "announcement": {"active": false, "headline": "", "body": ""}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO public.popup_guides (id, portal, audience_tone, title, intro, steps, footer_note, button_label, auto_show, active) VALUES
  (
    'home_welcome',
    'public',
    'polite',
    'How to Apply for Red Fiber Internet Online',
    'Welcome to PIGEM Combined Facilities Support Services. Applying for home fiber internet takes only a few minutes:',
    '["Choose the monthly Red Fiber plan that fits your household.", "Prepare an active Gmail address, your mobile number, and one valid government ID.", "Pin your house location on the map so our local team can check fiber availability.", "Submit your form to receive your official Reference Number right away."]'::jsonb,
    'Have an existing application? Click Customer Login anytime to check your status.',
    'Got It',
    false,
    true
  ),
  (
    'apply_before_start',
    'apply',
    'polite',
    'Welcome! Quick Instructions Before You Apply',
    'Thank you for applying with PIGEM Combined Facilities Support Services. To make your registration smooth and accurate, please keep these simple reminders in mind:',
    '["Select Your Plan & Enter Legal Name: Type your name and birth date exactly as printed on your valid government ID.", "Verify Your Contact Details: Click Send OTP to receive a 6-digit code in your Gmail inbox and confirm your Gmail address and mobile number.", "Pin Your Installation Address: Drag the map pin to your exact house or building and include a nearby landmark.", "Upload Clear Front & Back ID Photos: Place your original ID flat in a bright area with all 4 corners visible and no flash glare."]'::jsonb,
    'Once submitted, your official Reference Number appears immediately while our team reviews your application.',
    'Start My Application',
    true,
    true
  ),
  (
    'customer_portal_guide',
    'customer',
    'polite',
    'Welcome to Your Customer Portal',
    'Here you can comfortably monitor your internet service application from submission to installation:',
    '["Processing: Your application is actively being reviewed and coordinated by our team.", "Needs Correction (Inside Processing): If a detail or ID photo needs a quick update, a clear update form will appear right inside your application card.", "Approved or Rejected: Once finalized, you will receive a Gmail notice and see your final status here."]'::jsonb,
    'You can reopen this guide anytime using the Guide button in the top navigation bar.',
    'Continue to My Applications',
    true,
    true
  ),
  (
    'agent_workspace_guide',
    'agent',
    'professional',
    'Agent Workspace Quick Guide',
    'Welcome to Application Handling Management. Follow this clean 4-step workflow for every customer application:',
    '["Claim from Queue: Open Application Queue to claim incoming customer applications.", "Check Screening & ID Copies: Inspect the Cropped & Enhanced Copy alongside the Original Uploaded Photo. If Auto-Screening is unavailable, proceed directly using the Original Uploaded Photo.", "Forward for Encoding: Once verified, set status to Encoding when forwarding the application to the Provider Validator.", "Record Validator Decision: Update status to Approved or Rejected based on the Validator result, or use the optional Request Correction panel only if customer updates are needed."]'::jsonb,
    'Customers only ever see three main statuses: Processing, Approved, and Rejected.',
    'Open Workspace',
    true,
    true
  ),
  (
    'manager_dashboard_guide',
    'manager',
    'professional',
    'Manager Monitoring & CMS Guide',
    'Welcome to Application Monitoring Management. Your dashboard organizes daily operations and public content cleanly:',
    '["Queue & Override Monitoring: Track all customer applications, reassign agents, or update application statuses when needed.", "Verification Team Monitoring: Monitor active agent workloads and referral links (internal staff business accounts are provisioned by the System Administrator).", "Website Content Management System (CMS): Update hero banners, logos, plans, company profile, and FAQs safely without interrupting the live public website.", "Customer Announcements: Publish website announcements and dispatch promotional offers via PIGEM Gmail SMTP exclusively to opted-in @gmail.com Customers."]'::jsonb,
    'Internal system notices appear directly in your dashboard notifications whenever Maintenance Mode or Auto-Screening status changes.',
    'Continue to Dashboard',
    true,
    true
  ),
  (
    'admin_technical_guide',
    'admin',
    'technical',
    'Technical Management System - Cloud Architecture & Controls',
    'Administrator diagnostic reference for Vercel Serverless FastAPI endpoints, OpenCV + Google Gemini Vision screening, account governance, and in-system status alerts:',
    '["Vercel Serverless FastAPI (/api): Hosts REST endpoints (/api/health, /api/verify-captcha, /api/screen-async, /api/screen, /api/notify, /api/polite-remark) serving all external and internal web portals.", "Two-Stage OpenCV + Gemini Vision Pipeline: Stage 1 runs OpenCV blur, glare, brightness, and contrast diagnostics; Stage 2 generates a 4-corner perspective-cropped working copy in documents/cropped/ and executes Google Gemini Vision OCR + deterministic field comparison for human Agent confirmation.", "Account & Username Governance: Every Customer, Agent, Manager, and Admin account holds a unique username alongside its role-governed email address; Customers receive Gmail SMTP notifications while internal staff receive in-system website notifications.", "Protected System Switches: Maintenance Mode, AI Screening toggles, and Popup Guides (public.popup_guides) require explicit admin confirmation and broadcast status notifications to internal dashboards."]'::jsonb,
    'All administrative actions and login sessions are recorded in public.system_logs and public.login_history.',
    'Proceed to Console',
    true,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  portal = EXCLUDED.portal,
  audience_tone = EXCLUDED.audience_tone,
  title = EXCLUDED.title,
  intro = EXCLUDED.intro,
  steps = EXCLUDED.steps,
  footer_note = EXCLUDED.footer_note,
  button_label = EXCLUDED.button_label,
  auto_show = EXCLUDED.auto_show,
  active = EXCLUDED.active,
  updated_at = now();

SELECT 'Database setup complete.' AS result;
