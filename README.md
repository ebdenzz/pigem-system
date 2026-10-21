# PIGEM Web-Based Internet Service Application System

An enterprise-grade, web-based internet service application and customer lifecycle management platform developed for **Combined Facilities Support Services (PIGEM)** based in Dasmariñas City, Cavite.

---

## 📌 Project Overview

The **PIGEM Web-Based Internet Service Application System** streamlines the customer acquisition and onboarding process for residential fiber internet subscriptions (Red Fiber). It digitizes applicant registration, interactive fiber coverage pinning, identification document verification, customer communication, and internal administrative workflows into a unified cloud-native architecture.

### Key Objectives
- **Digital Customer Onboarding:** Eliminates manual paper forms with an interactive, responsive multi-step online application form with integrated geolocation pinning.
- **Data Privacy & Document Quality Screening:** Incorporates an on-premises AI screening engine utilizing computer vision (OpenCV) and optical character recognition (PaddleOCR) to detect image blur, glare, and data consistency without exposing sensitive government IDs to public third-party cloud LLMs.
- **End-to-End Operational Transparency:** Provides dedicated role-based portals for customers, verification agents, operations managers, and technical system administrators.

---

## 🌐 Live System Subsystems & Access Portals

The production web interface is hosted on **Vercel** and backed by **Supabase Cloud** (`PostgreSQL`, `Row-Level Security`, `Auth`, and `Storage Buckets`):

### 1. External Customer Subsystem
*Public portal for plan discovery, online registration, and application lifecycle monitoring.*
- **Public Home Page:** [https://pigem-system-web.vercel.app/index.html](https://pigem-system-web.vercel.app/index.html)
- **About PIGEM:** [https://pigem-system-web.vercel.app/about.html](https://pigem-system-web.vercel.app/about.html)
- **Application Form:** [https://pigem-system-web.vercel.app/apply.html](https://pigem-system-web.vercel.app/apply.html)
- **Account Activation:** [https://pigem-system-web.vercel.app/activate.html](https://pigem-system-web.vercel.app/activate.html)
- **Customer Login:** [https://pigem-system-web.vercel.app/login.html](https://pigem-system-web.vercel.app/login.html)
- **Customer Portal:** [https://pigem-system-web.vercel.app/customer.html](https://pigem-system-web.vercel.app/customer.html)

### 2. Internal Application Management Subsystem
*Operational workspace for fiber verification agents and operations managers.*
- **Internal Staff Login:** [https://pigem-system-web.vercel.app/staff-login.html](https://pigem-system-web.vercel.app/staff-login.html)
- **Agent Verification Workspace:** [https://pigem-system-web.vercel.app/agent.html](https://pigem-system-web.vercel.app/agent.html)
- **Manager Operations & Content CMS:** [https://pigem-system-web.vercel.app/manager.html](https://pigem-system-web.vercel.app/manager.html)

### 3. Internal Technical Management Subsystem
*Administrative console for system configuration, audit logging, and service provisioning.*
- **Admin Login:** [https://pigem-system-web.vercel.app/admin-login.html](https://pigem-system-web.vercel.app/admin-login.html)
- **Technical Management Dashboard:** [https://pigem-system-web.vercel.app/admin.html](https://pigem-system-web.vercel.app/admin.html)
- **Account Setup & Provisioning Portal:** [https://pigem-system-web.vercel.app/setup-accounts.html](https://pigem-system-web.vercel.app/setup-accounts.html)

---

## 🏛 System Architecture

The system utilizes a hybrid, privacy-preserving multi-tier architecture:

```
[ Customer / Staff Web Browser ]
              │
              ▼
   ┌──────────────────────┐
   │     Vercel Edge      │  <-- Static Web Frontend (HTML5, Vanilla JS, Leaflet)
   └──────────┬───────────┘
              │
      ┌───────┴────────────────────────┐
      ▼                                ▼
┌────────────────────────┐   ┌────────────────────────────────┐
│     Supabase Cloud     │   │   On-Premises / Workstation    │
│  - PostgreSQL DB       │   │   - Python FastAPI (Port 8001) │
│  - Storage Buckets     │   │   - OpenCV Blur/Glare Analysis │
│  - User Authentication │   │   - PaddleOCR Text Extraction  │
│  - Activity Logging    │   │   - Local Ollama (qwen2.5)     │
└────────────────────────┘   └────────────────────────────────┘
```

- **Resilient Offline Operation:** In compliance with Philippine Data Privacy Act regulations (RA 10173), document analysis runs locally on authorized workstations. If the workstation or AI engine is offline, the web system seamlessly falls back to **Manual Agent Verification Mode** without interruption to public application submissions.

---

## 🚀 Local AI Service Installation & Setup

To run the local Python FastAPI document screening service:

### Prerequisites
- Python 3.11+
- [Ollama](https://ollama.com/) with model `qwen2.5:1.5b`

### 1. Clone the Repository
```bash
git clone https://github.com/ebdenzz/pigem-system.git
cd pigem-system
```

### 2. Environment Configuration
Create a `.env` file inside the `api/` directory (or copy from `api/.env.example`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=PIGEM Support <onboarding@resend.dev>
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

### 3. Run the AI Screening Service
Using the automated launcher on Windows:
```cmd
START-AI.bat
```

Or manually via terminal:
```bash
cd api
python -m venv .venv311
.\.venv311\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001
```

---

## 📂 Repository Layout

```text
pigem_system/
├── web/                        # Production Frontend (Vercel Root)
│   ├── index.html              # Public Home Landing Page
│   ├── about.html              # Corporate Background & Service Strips
│   ├── apply.html              # Multi-Panel Application Form & Map
│   ├── activate.html           # One-Time Account Activation
│   ├── login.html              # Customer Authentication
│   ├── customer.html           # Customer Application Dashboard
│   ├── staff-login.html        # Internal Staff Authentication
│   ├── agent.html              # Agent Verification Workspace
│   ├── manager.html            # Operations Management & CMS
│   ├── admin-login.html        # System Administrator Authentication
│   ├── admin.html              # Technical Administration Dashboard
│   ├── setup-accounts.html     # Administrator Account Provisioning
│   ├── privacy.html            # Policy & Legal Notice
│   ├── assets/                 # Stylesheets, Brand Images, and Assets
│   └── js/                     # Modular Scripts (config, db, api, dash-ui)
├── api/                        # Local Python AI Backend Service
│   ├── main.py                 # FastAPI Application Gateway
│   ├── quality.py              # OpenCV Image Sharpness & Glare Detector
│   ├── ocr.py                  # PaddleOCR Text Recognition Engine
│   ├── ai.py                   # Ollama Local LLM Integration
│   ├── mailer.py               # Corporate Transactional Emailer
│   └── requirements.txt        # Python Backend Dependencies
├── START-AI.bat                # Windows Launcher for Local AI Engine
└── vercel.json                 # Vercel Deployment Configuration
```

---

## 📄 License & Ownership

Developed for **Combined Facilities Support Services (PIGEM)**.  
All rights reserved © 2026.
