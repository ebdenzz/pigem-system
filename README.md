# PIGEM Web-Based Internet Service Application System

A web-based fiber internet application, local AI-assisted document screening, and multi-portal management system developed for **PIGEM Combined Facilities Support Services** (Dasmariñas City, Cavite).

---

## 🌐 Live System Subsystems & Portals (Vercel)

The system is deployed on Vercel and backed by **Supabase Cloud** (`PostgreSQL`, `Auth`, and `Storage`), divided into **three independent subsystems**:

### 1. External Customer Subsystem (Public Website, Application & Customer Portal)
- **Public Home Page:** [https://pigem-system-web.vercel.app/index.html](https://pigem-system-web.vercel.app/index.html)
- **About PIGEM Page:** [https://pigem-system-web.vercel.app/about.html](https://pigem-system-web.vercel.app/about.html)
- **Online Application Form:** [https://pigem-system-web.vercel.app/apply.html](https://pigem-system-web.vercel.app/apply.html)
- **One-Time Account Activation:** [https://pigem-system-web.vercel.app/activate.html](https://pigem-system-web.vercel.app/activate.html)
- **Customer Login:** [https://pigem-system-web.vercel.app/login.html](https://pigem-system-web.vercel.app/login.html)
- **Customer Application Monitoring Portal:** [https://pigem-system-web.vercel.app/customer.html](https://pigem-system-web.vercel.app/customer.html)

### 2. Internal Application Management Subsystem (Verification Agents & Manager)
- **Internal Staff Login:** [https://pigem-system-web.vercel.app/staff-login.html](https://pigem-system-web.vercel.app/staff-login.html)
- **Agent Verification & Encoding Workspace:** [https://pigem-system-web.vercel.app/agent.html](https://pigem-system-web.vercel.app/agent.html)
- **Manager Monitoring & Content CMS Workspace:** [https://pigem-system-web.vercel.app/manager.html](https://pigem-system-web.vercel.app/manager.html)

### 3. Internal Technical Management Subsystem (System Administrator)
- **Admin Login:** [https://pigem-system-web.vercel.app/admin-login.html](https://pigem-system-web.vercel.app/admin-login.html)
- **Technical Management Dashboard:** [https://pigem-system-web.vercel.app/admin.html](https://pigem-system-web.vercel.app/admin.html)
- **Initial Admin & Manager Account Setup Portal:** [https://pigem-system-web.vercel.app/setup-accounts.html](https://pigem-system-web.vercel.app/setup-accounts.html)

---

## 🤖 Bakit Ollama at Local AI ang Ginamit? (Defense Guide & Rationale)

Madalas itanong sa defense: *"Bakit hindi na lang nag-host ng sariling AI sa cloud o gumawa ng sariling AI model mula sa umpisa?"*

Narito ang malinaw na paliwanag (Defense Points):

1. **Proteksyon sa Data Privacy (RA 10173 - Data Privacy Act of 2012):**
   - Ang mga aplikante ay nag-a-upload ng maselang **Government-Issued IDs** (PhilSys National ID, Driver's License, Passport).
   - Kung gagamit ng public third-party cloud AI (tulad ng standard cloud APIs), maaaring magkaroon ng risk na ma-expose o ma-log ang private IDs sa servers ng ibang kumpanya.
   - Dahil **Local ang Ollama (`qwen2.5:1.5b`)**, **OpenCV**, at **PaddleOCR**, ang image analysis at text verification ay tumatakbo **sa sariling authorized machine lamang**. Walang picture ng ID na ipinapadala sa labas.

2. **Walang Monthly API Costs (Zero Recurring Cloud Bill):**
   - Ang training at hosting ng custom cloud neural network ay nagkakahalaga ng libu-libong piso buwan-buwan para sa high-end GPU cloud instances (AWS/GCP).
   - Sa paggamit ng **Ollama**, libre at open-source ang AI runtime, kayang patakbuhin sa normal na computer o workstation nang walang dagdag na bayad.

3. **Graceful Offline Fallback (Hindi Babagsak ang System kahit Walang AI):**
   - Kapag naka-off ang local AI server (halimbawa kung offline ang workstation), **100% pa ring gumagana ang website sa Vercel at Supabase**.
   - Ang status sa Agent at Admin portal ay awtomatikong magiging **"AI Offline (Manual Review)"**. Ang ahente ay puwedeng mag-verify nang manu-mano gamit ang mga **Quick Select Presets** sa dropdown!

4. **Future Roadmap (In-House Dedicated Private Cloud Server):**
   - Para sa susunod na scale-up phase ng enterprise, ang local pipeline ay puwedeng ilipat sa isang **private dedicated on-premise cloud server** na eksklusibo lamang para sa kumpanya.

---

## 🚀 Paano Patakbuhin ang Local AI Server

Isang simpleng utos lamang ang kailangan para maging online ang AI document screening:

### Option A: Double-Click ang Batch File
I-double-click lamang ang:
```text
START-AI.bat
```

### Option B: Terminal Command (PowerShell / Command Prompt)
```powershell
cd api
.\.venv311\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

*(Siguraduhing bukas din ang Ollama sa background sa port 11434 sa pamamagitan ng pag-type ng `ollama run qwen2.5:1.5b`.)*

---

## 🎨 Paano Gawing Transparent ang Background ng Client / Partner Logos

Para maging malinis at transparent ang mga logo sa About page (hindi lumalabas na may puti o gray na box):

1. **Step 1:** Buksan ang libreng background removal tool: [remove.bg](https://www.remove.bg) o [tinypng.com](https://tinypng.com).
2. **Step 2:** I-upload ang logo image (hal. `client-infus8.png`, `client-radius.png`, o `client-maxcyc.png`).
3. **Step 3:** Awtomatikong aalisin ng tool ang puti o gray na background. I-download ang **Transparent PNG** file.
4. **Step 4:** Palitan ang file sa folder na:
   ```text
   web/assets/images/Clients/
   ```
   *(O i-upload ito gamit ang Manager CMS Dashboard sa `manager.html` sa ilalim ng **Clients** section!)*

---

## 🛠 Tech Stack Overview

- **Frontend & Deployment:** HTML5, CSS3, Vanilla JavaScript, Leaflet.js, OpenStreetMap, Vercel Static Hosting.
- **Backend & Cloud Database:** Supabase (`PostgreSQL`, `Storage Buckets`, `Authentication`, `Row-Level Security`).
- **Local AI Pipeline:** Python 3.11, FastAPI, OpenCV (Blur/Glare Detection), PaddleOCR (Text Extraction), Ollama (`qwen2.5:1.5b`), Resend API (Transactional Corporate Email).
