# PIGEM Web-Based Internet Service Application System

A web-based internet service application, AI-assisted document screening, and multi-portal management system developed for **PIGEM Combined Facilities Support Services** (Dasmariñas City, Cavite).

---

## 🌐 Live Deployment (Vercel)

The system is separated into **three independent subsystems** with isolated sessions and role-based access control:

1. **External Customer Subsystem (Public Website, Online Application & Customer Portal)**
   - **Public Home Page:** [https://pigem-system-web.vercel.app/index.html](https://pigem-system-web.vercel.app/index.html)
   - **About PIGEM Page:** [https://pigem-system-web.vercel.app/about.html](https://pigem-system-web.vercel.app/about.html)
   - **Online Application Form:** [https://pigem-system-web.vercel.app/apply.html](https://pigem-system-web.vercel.app/apply.html)
   - **One-Time Account Activation:** [https://pigem-system-web.vercel.app/activate.html](https://pigem-system-web.vercel.app/activate.html)
   - **Customer Login:** [https://pigem-system-web.vercel.app/login.html](https://pigem-system-web.vercel.app/login.html)
   - **Customer Application Monitoring Portal:** [https://pigem-system-web.vercel.app/customer.html](https://pigem-system-web.vercel.app/customer.html)

2. **Internal Application Management Subsystem (Verification Agents & Manager)**
   - **Staff Login & Registration (Agent / Manager):** [https://pigem-system-web.vercel.app/staff-login.html](https://pigem-system-web.vercel.app/staff-login.html)
   - **Agent Verification & Encoding Dashboard:** [https://pigem-system-web.vercel.app/agent.html](https://pigem-system-web.vercel.app/agent.html)
   - **Manager Monitoring & Content CMS Dashboard:** [https://pigem-system-web.vercel.app/manager.html](https://pigem-system-web.vercel.app/manager.html)

3. **Internal Technical Management Subsystem (System Administrator)**
   - **Admin Login & Registration:** [https://pigem-system-web.vercel.app/admin-login.html](https://pigem-system-web.vercel.app/admin-login.html)
   - **Technical Management Dashboard:** [https://pigem-system-web.vercel.app/admin.html](https://pigem-system-web.vercel.app/admin.html)

---

## ✨ Key Features

- **Online Fiber Application & Interactive Map Pinning:** Customers select a Red Fiber plan (`Plan 1000`, `Plan 1400`, `Plan 1900`), pin their exact installation coordinates via **Leaflet + OpenStreetMap + Nominatim**, and upload their valid government ID.
- **Preliminary AI Document Screening:**
  - Checks uploaded ID photos for blur/sharpness (Laplacian variance), brightness, glare, and text consistency using **OpenCV + PaddleOCR + Ollama (`qwen2.5:1.5b`)** when the local Python FastAPI service is active, with an automatic **Browser Canvas Image Quality & AI Fallback Engine** so screening and polite messages continue working 24/7 on Vercel even when the local Python server is offline.
- **Validator / RADIUS Remark $\rightarrow$ AI Polite Customer Message:**
  - Verification agents paste raw remarks from the provider validator (e.g., duplicate email in RADIUS, duplicate mobile number, or unreadable ID).
  - The AI engine converts the raw validator remark into a polite customer instruction and highlights the exact field(s) (`Email Address`, `Mobile Number`, `Valid ID Photo`, `ID Number`, or `Address`) in the Customer Portal.
  - Once the customer updates the flagged field(s), the system automatically verifies the change and returns the application status to **Processing**.
- **Original vs. Corrected Copy Comparison:** Preserves the customer's original submission alongside the latest corrected submission so agents can compare versions side-by-side.
- **Manager Content CMS & Supabase Bucket Media Switcher:**
  - Edit the **4 Home Hero Slides** and **4 About Hero Slides**, upload new banners/logos/vehicles/permits directly to the Supabase `website-assets` bucket, and switch between any saved bucket images at any time.
  - Opening Content CMS automatically enables **Maintenance Mode** to protect public pages while edits are in progress, with a live preview bypass for the Manager.
- **Technical Admin Controls:** Toggle AI Screening Maintenance Mode, Website Maintenance Mode, manage user accounts, and audit system/login logs.

---

## 🗂 Project Structure

```text
pigem_system/
├── web/                        # Frontend Web Application (Deployed on Vercel)
│   ├── index.html              # Public Home Page (Hero Slider, Plans, FAQs)
│   ├── about.html              # Company Profile, Clients, Vehicles, Permits
│   ├── apply.html              # Online Service Application Form + Leaflet Map
│   ├── activate.html           # One-Time Customer Account Activation
│   ├── login.html              # Customer Login
│   ├── customer.html           # Customer Application Monitoring & Correction Portal
│   ├── staff-login.html        # Agent & Manager Login / Registration
│   ├── agent.html              # Agent Verification, AI Log & Encoding Dashboard
│   ├── manager.html            # Manager Monitoring, Overrides & Content CMS
│   ├── admin-login.html        # System Administrator Login / Registration
│   ├── admin.html              # Technical Management (Maintenance, AI Toggle, Logs)
│   ├── assets/                 # Stylesheet (style.css) and Image Assets
│   └── js/                     # Modular Frontend Scripts (config, db, api, portals)
├── api/                        # Python FastAPI Backend (OpenCV, PaddleOCR, Ollama, Resend)
│   ├── main.py                 # FastAPI Endpoints (/health, /screen, /polite-remark, /notify)
│   ├── quality.py              # OpenCV Image Blur, Brightness & Glare Analysis
│   ├── ocr.py                  # PaddleOCR ID Text Extraction & Field Matching
│   ├── ai.py                   # Ollama (qwen2.5:1.5b) Screening Summary & Polite Remarks
│   ├── mailer.py               # Resend Transactional Email Service
│   └── requirements.txt        # Python Dependencies
├── supabase/
│   └── schema.sql              # Unified 12-Table PostgreSQL Schema & Storage Buckets
└── vercel.json                 # Vercel Static Hosting Configuration
```

---

## 🚀 Running the Local Python AI Backend (Optional Enhancement)

The live Vercel site works **24/7 on its own** using **Supabase Cloud** + the built-in **Browser Canvas Image Quality & AI Engine** in [`web/js/api.js`](web/js/api.js).

When presenting or testing on your local machine, you can also run the **Python FastAPI + OpenCV + PaddleOCR + Ollama (`qwen2.5:1.5b`) + Resend** server:

```powershell
cd api
.\.venv311\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```
