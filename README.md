# PIGEM Web-Based Internet Service Application System

A web-based internet service application, local AI-assisted document screening, and multi-portal management system developed for **PIGEM Combined Facilities Support Services** (Dasmariñas City, Cavite).

---

## 🌐 Live Web Deployment (Vercel)

The web interface is deployed on Vercel and connected to **Supabase Cloud** (`PostgreSQL`, `Authentication`, and `Storage`), separated into **three independent subsystems**:

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

## 🔒 Local-Only AI Architecture (Prototype Data Privacy & Offline Detection)

For data privacy and security of customer government IDs during the prototype stage, the AI screening stack runs **strictly locally** on the authorized workstation (`http://127.0.0.1:8001`):

- **When `START-SYSTEM.bat` (and local `Ollama qwen2.5:1.5b`) is running on the workstation:**
  - **Ollama (`qwen2.5:1.5b`)**, **OpenCV**, and **PaddleOCR** are **Online**.
  - Uploaded IDs are screened locally for blur/sharpness, brightness, glare, and OCR field consistency, and Agents can use **`✨ AI Generate Polite Message`** to convert raw RADIUS / Validator remarks into polite customer instructions.
- **When opened from another location or when local `Ollama` / `START-SYSTEM.bat` is not running:**
  - The **Technical Admin Console (`admin.html`)** and **Agent Dashboard (`agent.html`)** automatically detect and display that **Ollama AI and its related screening APIs (`OpenCV` and `PaddleOCR`) are OFFLINE**, and the system seamlessly operates in **Manual Agent Verification Mode**.
- **Future Work / Recommendation:**
  - Future iterations can transition from local Ollama to a dedicated, custom-trained private cloud AI model engineered specifically for secure telecommunication document screening.

---

## ✨ Key Features

- **Online Fiber Application & Interactive Map Pinning:** Customers select a Red Fiber plan (`Plan 1000`, `Plan 1400`, `Plan 1900`), pin their exact installation coordinates via **Leaflet + OpenStreetMap + Nominatim**, and upload their valid government ID.
- **Validator / RADIUS Remark $\rightarrow$ Polite Customer Message & Specific Field Detection:**
  - Verification agents paste raw remarks from the provider validator (e.g., duplicate email in RADIUS, duplicate mobile number, or unreadable ID) and specify the target field (`Email Address`, `Mobile Number`, `Valid ID Photo`, `ID Number`, or `Address`).
  - Once the customer updates the highlighted field(s) in `customer.html`, the system automatically verifies the change and returns the application status to **Processing**.
- **Original vs. Corrected Copy Comparison:** Preserves the customer's original submission alongside the latest corrected submission so agents can compare versions side-by-side.
- **Manager Content CMS & Supabase Bucket Media Switcher:**
  - Edit the **4 Home Hero Slides** and **4 About Hero Slides**, upload new banners/logos/vehicles/permits directly to the Supabase `website-assets` bucket, and switch between any saved bucket images at any time.
  - Opening Content CMS automatically enables **Maintenance Mode** to protect public pages while edits are in progress, with a live preview bypass for the Manager.

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
│   ├── admin.html              # Technical Management (Maintenance, AI Status, Logs)
│   ├── assets/                 # Stylesheet (style.css) and Image Assets
│   └── js/                     # Modular Frontend Scripts (config, db, api, portals)
├── api/                        # Local Python FastAPI Backend (OpenCV, PaddleOCR, Ollama, Resend)
│   ├── main.py                 # FastAPI Endpoints (/health, /screen, /polite-remark, /notify)
│   ├── quality.py              # OpenCV Image Blur, Brightness & Glare Analysis
│   ├── ocr.py                  # PaddleOCR ID Text Extraction & Field Matching
│   ├── ai.py                   # Ollama (qwen2.5:1.5b) Screening Summary & Polite Remarks
│   ├── mailer.py               # Resend Transactional Email Service
│   └── requirements.txt        # Python Dependencies
├── supabase/
│   └── schema.sql              # Unified 12-Table PostgreSQL Schema & Storage Buckets
├── START-SYSTEM.bat            # One-Click Local Launcher (Website + Local Python AI Server)
└── vercel.json                 # Vercel Static Hosting Configuration
```

---

## 🚀 Starting the Local AI Server (`START-SYSTEM.bat`)

To run the local Python FastAPI + OpenCV + PaddleOCR + Ollama (`qwen2.5:1.5b`) service on your workstation:

```powershell
cd api
.\.venv311\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```
*(Or double-click `START-SYSTEM.bat` in the project root.)*
