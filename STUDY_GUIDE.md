# PIGEM Web-Based Internet Service Application System - Complete Blended-Taglish Study Guide

Ang study guide na ito ay ginawa para maintindihan mo nang buong-buo, malinaw, at walang kalituhan ang buong **PIGEM Web-Based Internet Service Application System**—mula sa pinakasimpleng paliwanag ng mga technical terms, hanggang sa bawat SQL table, Python backend class/method, JavaScript function, UI structure, fail-safe mechanisms, at setup commands.

---

## 1. Simple Everyday Dictionary: Mga Nakakalitong Terms na Ipinaliwanag nang Pinakasimple

Bago tayo pumasok sa malalim na code, intindihin muna natin sa parang pang-araw-araw na kwento ang mga salitang madalas nakakalito kapag binabasa sa documentation o tinatanong sa defense:

### 1.1 Ano ang `CMS` (`Content Management System`)?
- **Ibig sabihin:** Ang **CMS** ay **Content Management System** (kaya mali o paulit-ulit kapag sinabing *"Content CMS"*—ang tamang tawag ay **Website Content (CMS)** o **Content Management System**).
- **Simpleng Analogy:** Isipin mo ang Facebook page mo. Kapag gusto mong magpalit ng Cover Photo o bio sa Facebook, hindi ka naman nagbubukas ng HTML code para mag-type ng `<img src="...">`, diba? Nagki-click ka lang ng **Upload Photo** at **Save**. Ganoon mismo ang CMS sa `web/manager.html`: isang dashboard kung saan pwedeng palitan ng Manager ang Hero Banners, Company Logo, Internet Plans, About Us, at FAQs ng public website (`index.html` at `about.html`) nang walang ginagalaw na code. Lahat ng in-edit niya ay sine-save sa `public.website_content` table at `website-assets` bucket sa Supabase.
- **Bakit Hindi Automatic Nag-o-off ang Website Pagbukas ng CMS?** Dati, nakakagulat kung pag-click pa lang ng Manager sa CMS tab ay bigla nang magla-lock ang public website. Ngayon, malinis at safe na ito: pagbukas mo ng **Website Content (CMS)** sa `manager.html`, **nananatiling live at bukas ang website** para sa mga customers. Kung gusto lang talagang isara pansamantala ng Manager o Admin ang website habang may malaking inaayos, saka lang niya pipindutin ang **Maintenance Mode** button na may **Confirmation Pop-up** muna bago gumana.

### 1.2 Ano ang `FastAPI`, `Uvicorn`, `http://127.0.0.1:8001`, `ASGI`, at `REST Endpoints`?
Madalas nakakalito kung bakit dalawa pa ang pangalan (**FastAPI** at **Uvicorn**) sa `api/main.py`. Gamitin natin ang **Fast-Food Restaurant Analogy**:

1. **`http://127.0.0.1:8001` (Ang Address at Pinto ng Restaurant sa Computer Mo)**:
   - Ang `127.0.0.1` (tinatawag ding `localhost`) ay special IP address na ang ibig sabihin ay **"itong sarili kong computer mismo"**.
   - Ang `:8001` naman ay ang **Port Number** o **Door Number #8001**. Dahil maraming programs ang tumatakbo sa Windows (gaya ng browser, Spotify, o Ollama sa door `11434`), kailangan ng sariling pinto ng PIGEM system para alam ng browser kung saan kakatok.
2. **`Uvicorn` at `ASGI` (Ang Kuryente, Pintuan, at Receptionist sa Door #8001)**:
   - Ang Python code (`main.py`) mag-isa ay parang recipe book lang—hindi siya marunong makinig sa network port `8001` nang mag-isa.
   - Si **Uvicorn** ang program na nagbubukas ng Door `8001`, tumatanggap ng katok mula sa browser (HTTP requests), at nagpapasa nito sa Python code mo.
   - Ang ibig sabihin ng **ASGI** (*Asynchronous Server Gateway Interface*) ay isa siyang **mabilis na receptionist na kayang tumanggap ng maraming customers nang sabay-sabay** nang hindi sinasarado ang pinto habang may niluluto pa sa loob.
3. **`FastAPI` at `REST Endpoints` (Ang Menu Counter Windows sa Loob ng Restaurant)**:
   - Kung si Uvicorn ang pintuan at receptionist, si **FastAPI** naman ang **Order Counter System** sa loob ng `api/main.py` na nagdidirekta kung saang window pupunta ang bawat request.
   - Ang **REST Endpoints** ay parang **5 magkakaibang Counter Windows** na may kanya-kanyang trabaho:
     - **`GET /health` (Window 1 - Status Check)**: Tinatanong ng browser: *"Bukas ba ang server, OpenCV, PaddleOCR, Ollama, at email?"* Sasagot agad ito ng JSON status.
     - **`POST /screen-async` (Window 2 - Drop-Off Screening Window)**: Ibibigay lang ng browser ang `application_id` para ipasuri sa likod (kusina), tapos aalis na agad ang browser nang hindi naghihintay.
     - **`POST /screen` (Window 3 - Direct ID Scan)**: Backup counter kung saan pwedeng mag-upload ng ID file nang direkta.
     - **`POST /notify` (Window 4 - Email Messenger Window)**: Tinatawagan kapag magpapadala ng OTP, confirmation, `Needs Correction` notice, status update, o promo email.
     - **`POST /polite-remark` (Window 5 - Polite Message Writer)**: Tinatawagan kapag pinindot ng Agent ang **Generate Polite Message** para gawing magalang ang note para sa customer.
   - Bukod sa 5 windows na iyan, sine-serve din ng FastAPI ang buong `web/` folder (`index.html`, `apply.html`, `agent.html`, at iba pa) kaya pagbukas mo ng `http://127.0.0.1:8001`, buong website at backend na agad ang kasama.

### 1.3 Ano ang `Synchronous vs Asynchronous`, `POST /screen-async`, at `ThreadPoolExecutor(max_workers=4)`?
Ito ang dahilan kung bakit **mabilis sa customer** at **kaya ang sabay-sabay na nag-a-apply**:

- **Synchronous ("Hintay-sa-Harap-ng-Cashier"):**
  Isipin mo na nag-order ka ng pagkain na 30 seconds lutuin. Kung *synchronous* ang pila, nakatayo ka lang sa harap ng cashier at naka-freeze ang screen mo hanggang maluto ang pagkain. Ganoon ang mangyayari kung pag-click ng **Submit** ng customer ay hihintayin pa niyang matapos mag-crop at magbasa ng ID bago lumabas ang Reference Number niya.
- **Asynchronous via `POST /screen-async` ("Claim-Stub / Buzzer System"):**
  Sa PIGEM system, pag-click ng customer ng **Submit** sa `apply.html`:
  1. Ang loading screen na nakikita ng customer ay **pag-upload lang ng ID photo sa Supabase `documents` bucket at pag-save ng form** (ilang segundo lang).
  2. Lalabas **agad** ang Reference Number (`PIGEM-...`) ng customer—tapos na ang paghihintay niya!
  3. Sa likod ng eksena, bumubulong ang browser sa `POST /screen-async`: *"Pakisuri na sa background itong Application ID na ito."* Ang ibig sabihin ng `async` (*asynchronous*) ay **hindi hihintayin ng customer na matapos ang screening**; ang **Agent** sa `agent.html` ang makakakita sa queue na nag-i-screen pa ito (`Screening in Progress`).
- **`ThreadPoolExecutor(max_workers=4)` (Apat na Taga-Suri sa Kusina nang Sabay-Sabay):**
  Isipin mo na sa loob ng `api/screening.py`, nag-hire ka ng **4 na dedicated staff (`max_workers=4`)** na may sari-sariling lamesa.
  - Kung may **4 na customers** na sabay-sabay nag-click ng Submit sa parehong segundo, bawat isa sa 4 workers ay kukuha ng tig-isang application at **sabay-sabay silang mag-i-screen** (parallel).
  - Paano kung **10 customers** ang sabay nag-apply? Yung unang 4 ay gagawin agad nang sabay, at yung natitirang 6 ay ilalagay nang maayos sa waiting list (`queue`). Sa sandaling matapos ang Worker #1, kukunin niya agad ang ika-5 application. Bakit `4` ang nilagay at hindi `100`? Dahil mabigat sa CPU at RAM ang pag-crop ng larawan (OpenCV) at pagbasa ng text (PaddleOCR); ang `4 workers` ang sweet spot para mabilis ang sabay-sabay na gawa nang hindi nagha-hang ang computer.

### 1.4 Ano ang `SMTP`, `Port 587`, `STARTTLS`, at `16-Character Google App Password`?
Kapag nagpapadala ng OTP o `Needs Correction` email ang `api/mailer.py`, ito ang ginagamit niya:

- **SMTP (`Simple Mail Transfer Protocol`)**: Ito ang **universal na patakaran ng Post Office sa internet** para sa pagpapadala ng papalabas na email. Kung ang browser ay gumagamit ng `HTTP` para magbukas ng webpage, ang Python email sender naman ay gumagamit ng `SMTP` para maghulog ng sulat sa Gmail.
- **`smtp.gmail.com` at `Port 587`**: Ang `smtp.gmail.com` ang official Post Office building ni Google, at ang `Port 587` ang standard submission door para sa mga systems/apps na magpapadala ng email.
- **`STARTTLS` (Selyadong Armored Van)**: Bago ibigay ng `mailer.py` ang login at laman ng email ng customer, tinatawag niya ang `server.starttls()`. Ginagawa nitong **encrypted (naka-lock sa kaha)** ang koneksyon para walang hacker sa Wi-Fi o network na makakasilip sa OTP code o email ng customer.
- **`16-Character Google App Password`**: Hindi tinatanggap ng Gmail ang regular mong Gmail password sa Python code dahil may 2-Step Verification si Google. Kaya sa Google Account Security settings, gumagawa ka ng **16-letter App Password** (`abcd efgh ijkl mnop`). Espesyal na susi ito na pang-send lang ng email ng PIGEM system at ligtas kahit palitan o i-delete anumang oras.

### 1.5 Ano ang `Bearer Token` (`Authorization: Bearer <token>`) at `JWT`?
Makikita mo sa `api/auth.py` at `web/js/api.js` ang linya na `"Authorization": "Bearer " + token`. Ano ba talaga iyon?

- **Kahulugan ng salitang `"Bearer"`**: Sa simpleng English, ang *bearer* ay **"ang taong may hawak nito"** (parang sa concert ticket: *"Admit the bearer of this ticket"*).
- **Paano ito gumagana (VIP Wristband Analogy)**:
  1. Pag nag-login ang Customer, Agent, Manager, o Admin, binibigyan siya ng Supabase ng mahabang digital pass na tinatawag na **JWT (`JSON Web Token`)**—isipin mo itong **VIP Wristband na may digital signature**.
  2. Tuwing magre-request ang browser sa FastAPI server, ipinapakita niya sa header ang: `Authorization: Bearer eyJhbGciOiJIUzI1Ni...` na ang ibig sabihin ay: *"Papasukin mo itong request dahil hawak ko itong valid token."*
  3. Sa `api/auth.py`, chine-check muna ng Regex (`^Bearer\s+([A-Za-z0-9._\-]+)$`) kung tama ang porma ng wristband, tapos tinatanong nito ang Supabase (`/auth/v1/user`) kung tunay at hindi pa expired ang token bago kilalanin ang user.

---

## 2. System Overview, Roles, Fail-Safe Flow, at Pop-up Guide Architecture

Ang system ay dinevelop para sa **PIGEM Combined Facilities Support Services** sa Dasmarinas City, Cavite bilang online application, 2-layer document screening, at monitoring platform para sa residential **Red Fiber** internet plans.

### 2.1 Apat na User Roles, Portals, at Tone ng Content

| Role | Portal File | Login Page | Tone ng UI & Pop-ups | Main Responsibility sa System |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | `web/customer.html` | `web/login.html` | **Simple, Polite, Non-Technical** | Nag-a-apply sa `apply.html` (na may pre-application pop-up guide), nag-a-activate sa `activate.html`, tumitingin ng **3 statuses lang** (`Processing`, `Approved`, `Rejected`), at nag-a-update sa loob ng `Processing` kapag `Needs Correction`. |
| **Agent** | `web/agent.html` | `web/staff-login.html` | **Clean, Structured, Non-Technical** | Humahawak ng customer applications sa 4-section organized modal, tumitingin sa `Cropped & Enhanced Copy` o `Original Uploaded Photo`, nagfo-forward sa Provider Validator (`Encoding`), at nagre-record ng Validator decision (`Approved` / `Rejected`). |
| **Manager** | `web/manager.html` | `web/staff-login.html` | **Professional, Clear, Non-Technical** | Nagmo-monitor ng lahat ng applications at workload ng agents, nagre-reassign o nag-o-override ng status, gumagawa ng Agent accounts, nagpapadala ng promos, at humahawak ng **Website Content (CMS)** nang hindi napuputol ang live website. |
| **Admin** | `web/admin.html` | `web/admin-login.html` | **Detailed Technical Control** | Humahawak ng **Technical Management System**: dito lang makikita ang AI Screening Engine toggle, active background worker jobs, FastAPI, OpenCV, PaddleOCR, Ollama, Gmail SMTP, Supabase health, Maintenance Mode, Popup Guides table, accounts, at audit logs. |

> [!IMPORTANT]
> **Strict Non-Technical Language Rule:** Walang lumalabas na salitang `AI`, `FastAPI`, `Uvicorn`, `OpenCV`, `PaddleOCR`, o `Ollama` sa Customer, Agent, at Manager portals o sa customer emails. Tanging **Admin (`admin.html`)** lang ang gumagamit ng technical diagnostics at controls.

### 2.2 End-to-End Application Flow (Kasama ang Auto-Screening Offline Fail-Safe!)

```mermaid
flowchart TD
    A["1. Customer opens apply.html -> Sees polite Pre-Application Instruction Pop-up"] --> B["2. Fills form, verifies Gmail OTP, pins map, uploads Valid ID to Supabase documents Bucket"]
    B --> C["3. Row saved in public.applications -> Customer gets Reference No. immediately"]
    C --> D{"4. Is Auto-Screening ON and Python Server Online?"}
    D -- "NO (Disabled or Server Offline)" --> E["Fail-Safe Fallback: Sets state = unavailable / paused + Keeps Original Uploaded ID Copy"]
    E --> F["Sends Alert Notification + Calm Banner to ALL Agents & Managers -> Direct Manual Review"]
    D -- "YES (Online)" --> G["POST /screen-async -> ThreadPoolExecutor(max_workers=4)"]
    G --> H["Layer 1 Fast Scan: Quick Quality + Raw OCR -> Early Hold Warning & ETA (~20s) on Agent Queue"]
    H --> I["Layer 2 Deep Scan: 4-Corner Auto-Crop + Contrast Enhancement -> Saves Cropped JPEG to documents/cropped/"]
    I --> J{"Simple Mismatch Detected? (Name, Birth Date, ID No, or Blurry ID)"}
    J -- "Yes" --> K["Auto-sets Needs Correction + Sends Gmail Correction Notice & Portal Alert to Customer"]
    J -- "No" --> L["Marks Screening Passed -> Agent reviews 4-Section Modal (Cropped vs Original ID)"]
    F --> L
    K --> M["Customer submits highlighted field update in customer.html -> Re-triggers screening"]
    L --> N["Agent forwards to Provider Validator (Encoding) -> Validator decides Approved or Rejected"]
```

### 2.3 Paano Gumagana ang `Needs Correction` Notification Email (Automatic at Manual)?
100% gumagana ang `Needs Correction` email sa **dalawang paraan**, at parehong dumadaan sa `POST /notify` -> `api/mailer.py` (`build_correction_notice_html`):
1. **Automatic Screening Request (`api/screening.py`)**: Kapag natapos ang Layer 2 at nakumpirmang hindi tugma ang `Full Name`, `Birth Date`, o `ID Number`, o sobrang labo ng `ID Photo` (habang wala pang final decision ang Agent), kusang gagawa ng magalang na instruction ang backend, ise-set ang `status = "Needs Correction"`, ise-save sa `public.corrections` at `public.notifications`, at magpapadala agad ng **Action Needed: Please Update Your Application** email sa Gmail ng customer.
2. **Manual Agent o Manager Request (`web/js/agent.js` Section 4 at `web/js/manager.js` Override Modal)**: Kapag may pinapabago ang Provider Validator o Agent (halimbawa maling house landmark o kailangang palitan ang ID), pipiliin lang ng Agent ang field sa **Section 4**, pwedeng pindutin ang **Generate Polite Message**, at pag-save ng `Needs Correction`, tatawagin ng `apiSendStatusEmail()` / `apiSendCorrectionEmail()` ang `POST /notify` kasama ang `target_summary` at `custom_note` para ma-email agad si customer.
3. **RA 10173 Privacy Safety sa Email**: Hindi kailanman inilalagay sa email ang picture ng ID o buong ID number ng customer. Sinasabi lang sa email kung anong kategorya ang ia-update (halimbawa *Full Name on Valid ID* o *Clearer Valid ID Photo*) at may button papunta sa secure Customer Portal (`login.html`).

### 2.4 Paano Gumagana ang Fail-Safe Kapag Nawala o Naka-Off ang Auto-Screening?
Paano kung naka-off ang `ai_enabled` sa Admin, o naka-close ang `START-AI.bat` (`FastAPI` server offline), o hindi naka-load ang OpenCV/PaddleOCR?
1. **Walang Abala sa Customer**: Sa `apply.js` (`submitRegistration`) at `customer.js` (`submitCustomerCorrection`), may 3.5-second fail-fast timeout (`AbortController`) ang `apiStartBackgroundScreening()`. Kapag offline ang server, **hindi mag-e-error ang application ng customer**. Pasok pa rin sa `public.applications` ang form niya at nasa Supabase `documents` bucket na ang **Original Uploaded ID Copy** (`id_front_path` at `id_back_path`).
2. **Original Copy Fallback**: Sine-set ng system ang `screening` JSON sa `state: "unavailable"` (o `"paused"` kung in-off ng Admin) at `fallback_original_only: true`, kaya sa halip na maghanap ng cropped copy, automatic na **Original Uploaded Photo** ang ipinapakita sa Agent at Manager.
3. **Automatic Notification sa Lahat ng Agents at Managers**:
   - Kung naka-off ang Python server, tinatawag ng browser ang `dbNotifyScreeningUnavailable()` (`web/js/db.js`).
   - Kung bukas ang Python server pero naka-disable ang AI o kulang ang OCR library, tinatawag ng `api/screening.py` ang `_notify_staff_unavailable()` (may 60-second anti-spam cooldown).
   - Pareho silang naglalagay ng alert rows sa `public.notifications` para sa `role = 'agent'` at `role = 'manager'`, at naglalabas din ang `checkAgentScreeningService()` (`agent.js`) at `checkMgrScreeningService()` (`manager.js`) ng malinaw na info banner sa taas ng dashboard nila.

### 2.5 Bagong Table para sa System-Wide Pop-up Instructions (`public.popup_guides`)
Para hindi malito ang kahit sinong gagamit ng external at internal pages, may dedicated database table na **`public.popup_guides`** at OOP class na **`PopupGuideManager`** (`web/js/config.js`):
- **External / Public (`index.html` at `apply.html`)**: Sa `index.html`, may **How to Apply** button (`home_welcome`). Sa `apply.html`, pagka-verify ng CAPTCHA bago pa magsimulang mag-type ang customer, automatic na lumalabas ang **`apply_before_start`** pop-up na magalang na nagpapaliwanag ng 4 steps (exact legal name, Gmail OTP, map pin, at malinaw na 4-corner ID photo).
- **Internal Staff & Customer (`customer.html`, `agent.html`, `manager.html`)**: Unang bukas sa session ay nagpapakita ng maikli, malinis, at polite/professional na workflow guide, at pwedeng buksan ulit anumang oras gamit ang **Guide** button sa topbar.
- **Internal Admin (`admin.html`)**: Gumagamit ng `audience_tone = 'technical'` (`admin_technical_guide`) na nagpapaliwanag ng FastAPI workers, Layer 1/Layer 2 pipeline, fail-safe fallback, at protected switches. Pwede ring i-enable o i-disable ng Admin ang `auto_show` ng bawat pop-up guide direkta sa `admin.html`.

---

## 3. Commands sa Pag-download, Pag-setup, at Pag-start ng System

### 3.1 Pag-install ng Lahat ng Technologies (Windows PowerShell)

```powershell
# 1. I-install ang Python 3.11 (required para sa PaddleOCR C++ wheels) at Ollama
winget install Python.Python.3.11
winget install Ollama.Ollama

# 2. I-download ang local language model para sa Ollama
ollama pull qwen2.5:1.5b

# 3. Pumunta sa api folder at gumawa ng Python 3.11 virtual environment (.venv311)
cd C:\pigem-system\api
py -3.11 -m venv .venv311

# 4. I-activate ang virtual environment at i-install ang lahat ng libraries
.\.venv311\Scripts\activate
pip install -r requirements.txt
```

Laman ng `api/requirements.txt`:

```text
fastapi==0.115.6
uvicorn==0.34.0
python-multipart==0.0.20
python-dotenv==1.0.1
httpx==0.28.1
numpy==1.26.4
opencv-python-headless==4.10.0.84
paddlepaddle==2.6.2
paddleocr==2.8.1
```

### 3.2 Pag-configure ng `api/.env`

```powershell
cd C:\pigem-system\api
copy .env.example .env
```

Ilagay ang iyong credentials sa `C:\pigem-system\api\.env`:

```ini
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
SMTP_FROM=PIGEM Combined Facilities Support Services <yourgmail@gmail.com>
```

### 3.3 Pag-start ng System

Unang terminal (para sa local Ollama language helper):

```powershell
ollama run qwen2.5:1.5b
```

Pangalawang terminal (o i-double click lang ang `START-AI.bat`):

```powershell
cd C:\pigem-system\api
$env:PYTHONDONTWRITEBYTECODE="1"
.\.venv311\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

> [!TIP]
> Pinipigilan ng `PYTHONDONTWRITEBYTECODE=1` ang paggawa ng `__pycache__` folders para laging malinis ang `api/` directory mo.

---

## 4. Core Programming Concepts sa Codebase (OOP, Regex, at Nested Logic)

### 4.1 Object-Oriented Programming (OOP) Pillars

| OOP Pillar | Paano Ginamit sa Simpleng Paliwanag | Eksaktong Classes sa Codebase |
| :--- | :--- | :--- |
| **Abstraction** | Gumagawa ng base/parent class na may nakatakdang template method (`raise NotImplementedError`) para iisa ang standard contract ng mga child classes. | `BaseTokenVerifier` (`auth.py`), `BaseImageProcessor` (`quality.py`), `BaseTextMatcher` (`ocr.py`), `BaseLanguageClient` (`ai.py`), `BaseCloudGateway` (`screening.py`), at `BaseFieldValidator` (`config.js`). |
| **Inheritance** | Minamana ng child class ang shared methods at properties ng parent class (`super()`) para malinis at walang duplicate code. | `FastQualityScanner` at `DocumentCropEnhancer` na parehong nagmamana sa `BaseImageProcessor` (`quality.py`); `ApplicantFormValidator` na nagmamana sa `BaseFieldValidator` (`config.js`). |
| **Encapsulation** | Tinatago sa loob ng class ang internal state, locks, cache, at helper methods (`_engine`, `_lock`, `_guideMap`, `_alert_lock`) para ligtas at organisado ang data. | `PopupGuideManager` (`config.js`) na nag-e-encapsulate ng `_guideMap` at session storage keys; `BackgroundScreeningCoordinator` (`screening.py`) na nag-e-encapsulate ng `_executor`, `_active_jobs`, at `_alert_lock`. |

### 4.2 Regular Expressions (Regex)

1. **Bearer Header Validation (`api/auth.py`)**: `r"^Bearer\s+([A-Za-z0-9._\-]+)$"` — sinisiguradong malinis na JWT token ang ipinasa sa `Authorization` header.
2. **25 Valid ID Formats + Mobile/Email (`web/js/config.js`)**: Bawat government/secondary ID sa `CONFIG.ID_TYPES` ay may sariling Regex pattern (halimbawa `/^(\d{12}|\d{16})$/` sa National ID, `/^[A-Z]\d{10}$/` sa Driver's License, at `/^09\d{9}$/` sa PH mobile number).
3. **OCR Date & ID Normalization (`api/ocr.py`)**: Gumagamit ng `r"[^A-Z0-9]"` para tanggalin ang spaces at dashes sa ID number bago ikumpara, at 4 date Regex patterns (`YYYY-MM-DD`, `MM/DD/YYYY`, `Month DD, YYYY`, `DD Month YYYY`) para i-convert sa iisang format ang birthday sa ID.
4. **Plain-Language Sanitizer & Field Detector (`api/ai.py`)**: Hinaharang ng `_TECH_TERMS_REGEX` (`r"\b(OpenCV|PaddleOCR|Ollama|Qwen\S*|CLAHE|Laplacian|AI)\b"`) ang anumang technical jargon para mapalitan ng `"screening"`, habang hinahanap ng `_FIELD_PATTERNS` kung aling field (`name`, `birth_date`, `id_number`, `id_photo`, `email`, `phone`, `address`) ang ihahighlight sa customer portal.
5. **Base64 Fallback Decoder (`api/screening.py`)**: `r"^data:image/[a-zA-Z0-9.+-]+;base64,(.+)$"` — kumukuha ng image bytes kung naka-Data URL fallback ang document.

### 4.3 Nested Operations (Nested `if-else` at Nested `for` Loops)

- **Nested Quality Severity Checks (`api/quality.py`)**: Sa `FastQualityScanner.process()`, chine-check muna kung `blur_score < 60.0`, at sa loob nito ay may nested `if blur_score < 42.0` para malaman kung `severe = True` (maglalabas agad ng `"Hold Recommended"` warning sa Agent) o normal enhancement lang.
- **Nested 4-Corner ID Detection (`api/quality.py`)**: Sa `_find_card_quad()`, may outer loop ng Canny edge thresholds `((40, 140), (25, 100))` at inner loop sa contours na sumusuri kung sakop ng hugis ang `16%` hanggang `94%` ng frame at kung eksaktong `4` ang kanto (`len(approx) == 4`).
- **Nested Fuzzy Name Matching (`api/ocr.py`)**: Sa `compare()`, bawat salita sa pangalan ng applicant (`for part in name_parts`) ay kinukumpara sa bawat salitang nabasa sa ID (`for word in ocr_words`) gamit ang `SequenceMatcher(None, part, word).ratio() >= 0.80` para hindi magkamali kahit may kaunting glare sa isang letra.

---

## 5. Database Reset (`DROP` Query) at Complete 13-Table `schema.sql`

### 5.1 Separate `DROP` Query (Patakbuhin Muna sa Supabase SQL Editor Kapag Magre-reset ng Database)

Walang `DROP` commands sa loob ng `schema.sql` para malinis itong pure creation script. Kapag gusto mong linisin muna lahat ng lumang tables bago i-import ulit ang `schema.sql`, patakbuhin muna ito:

```sql
DROP POLICY IF EXISTS "Allow public access to website-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow access to documents" ON storage.objects;

DROP TABLE IF EXISTS public.popup_guides CASCADE;
DROP TABLE IF EXISTS public.system_logs CASCADE;
DROP TABLE IF EXISTS public.login_history CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.corrections CASCADE;
DROP TABLE IF EXISTS public.screenings CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.agent_links CASCADE;
DROP TABLE IF EXISTS public.website_content CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
```

### 5.2 Complete Final `schema.sql` (13 Tables + Storage Buckets + Seed Data)

```sql
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  speed INTEGER NOT NULL CHECK (speed > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  tag TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.system_settings (
  id TEXT PRIMARY KEY,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.website_content (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  agree_tu BOOLEAN DEFAULT false,
  original_copy JSONB,
  original_submission JSONB,
  corrected_copy JSONB,
  has_correction BOOLEAN DEFAULT false,
  screening JSONB DEFAULT '{}'::jsonb,
  ai_result JSONB,
  ai_log JSONB DEFAULT '[]'::jsonb,
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
  encoded BOOLEAN DEFAULT false,
  encoded_proof TEXT,
  encoding_proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_email ON public.applications (email);
CREATE INDEX idx_applications_status ON public.applications (status);
CREATE INDEX idx_applications_assigned_agent ON public.applications (assigned_agent);
CREATE INDEX idx_applications_created_at ON public.applications (created_at DESC);

CREATE TABLE public.documents (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT REFERENCES public.applications(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'original',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.screenings (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT REFERENCES public.applications(id) ON DELETE CASCADE,
  quality JSONB,
  ocr JSONB,
  comparisons JSONB,
  ai_remark TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.corrections (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT REFERENCES public.applications(id) ON DELETE CASCADE,
  agent_id TEXT,
  issue_note TEXT NOT NULL,
  customer_response JSONB,
  status TEXT NOT NULL DEFAULT 'Pending Customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX idx_notifications_email ON public.notifications (email);
CREATE INDEX idx_notifications_role ON public.notifications (role);

CREATE TABLE public.login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  role TEXT,
  action TEXT NOT NULL DEFAULT 'login',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.system_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_email TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.popup_guides (
  id TEXT PRIMARY KEY,
  portal TEXT NOT NULL
    CHECK (portal IN ('public', 'apply', 'customer', 'agent', 'manager', 'admin')),
  audience_tone TEXT NOT NULL DEFAULT 'polite'
    CHECK (audience_tone IN ('polite', 'professional', 'technical')),
  title TEXT NOT NULL,
  intro TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  footer_note TEXT NOT NULL DEFAULT '',
  button_label TEXT NOT NULL DEFAULT 'Got It',
  auto_show BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on login_history" ON public.login_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_logs" ON public.system_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on popup_guides" ON public.popup_guides FOR ALL USING (true) WITH CHECK (true);

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
  '{"logo_image": "logo.png", "area_text": "Available in select Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu areas.", "client_images": ["Clients/client-infus8.png", "Clients/client-radius.png", "Clients/client-maxcyc.png"]}'::jsonb
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
    '["Select Your Plan & Enter Legal Name: Type your name and birth date exactly as printed on your valid government ID.", "Verify Your Contact Details: Click Send OTP to receive a 6-digit code in your Gmail inbox and confirm your email and mobile number.", "Pin Your Installation Address: Drag the map pin to your exact house or building and include a nearby landmark.", "Upload Clear Front & Back ID Photos: Place your original ID flat in a bright area with all 4 corners visible and no flash glare."]'::jsonb,
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
    '["Processing: Your application is actively being reviewed and coordinated by our team.", "Needs Correction (Inside Processing): If a detail or ID photo needs a quick update, a clear update form will appear right inside your application card.", "Approved or Rejected: Once finalized, you will receive an email notice and see your final status here."]'::jsonb,
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
    '["Queue & Override Monitoring: Track all customer applications, reassign agents, or update application statuses when needed.", "Verification Team Management: Monitor active agent workloads, view referral links, and onboard new agents.", "Website Content Management System (CMS): Update hero banners, logos, plans, company profile, and FAQs safely without interrupting the live public website.", "Promotional Campaigns: Send branded announcements and fiber offers to active customers."]'::jsonb,
    'Note: Opening the CMS editor keeps the public website live unless Maintenance Mode is explicitly enabled.',
    'Continue to Dashboard',
    true,
    true
  ),
  (
    'admin_technical_guide',
    'admin',
    'technical',
    'Technical Management System - Architecture & Controls',
    'Administrator diagnostic reference for local FastAPI workers, AI screening engines, cloud storage buckets, and SMTP transport:',
    '["FastAPI + Uvicorn (127.0.0.1:8001): Serves REST endpoints (/health, /screen-async, /screen, /notify, /polite-remark) and dispatches ThreadPoolExecutor(max_workers=4) background jobs.", "2-Layer Document Pipeline: Layer 1 runs FastQualityScanner + raw PaddleOCR for immediate queue ETA/warnings; Layer 2 runs 4-corner perspective homography + LAB CLAHE cropping to documents/cropped/ and Ollama (qwen2.5:1.5b) text synthesis.", "Fail-Safe Manual Fallback: If AI Screening is disabled or FastAPI/OCR is offline, applications proceed uninterrupted using original Supabase documents bucket files and broadcast alerts notify all Agents and Managers.", "Protected System Switches: Maintenance Mode, AI Screening toggles, and Popup Guides (public.popup_guides) require explicit admin confirmation before state changes take effect."]'::jsonb,
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
```

### 5.3 Buod ng Lahat ng 13 Tables sa Database

1. **`public.users`**: Lahat ng accounts (`admin`, `manager`, `agent`, `customer`), kasama ang 6-digit `activation_code` para sa bagong customer at `reset_code` para sa password recovery.
2. **`public.plans`**: Ang Red Fiber broadband plans (`Plan 1000`, `Plan 1400`, `Plan 1900`) na may positive speed at price `CHECK` constraints.
3. **`public.system_settings`**: Single row (`id = 'main'`) na may `ai_enabled` at `maintenance_mode` switches.
4. **`public.website_content`**: JSONB storage (`id = 'main'`) ng **Website Content (CMS)** para sa hero slides, company story, service areas, FAQs, at uploaded media list.
5. **`public.agent_links`**: Referral codes (`REF-XXXXX`) ng mga Agents para automatic ma-assign sa kanila ang referred customer applications.
6. **`public.applications`**: Main application records kasama ang GPS coordinates (`lat`, `lng`), original ID bucket paths (`id_front_path`, `id_back_path`), Layer 2 cropped ID path (`cropped_id_path`), `original_copy` vs `corrected_copy` JSON snapshots, at real-time `screening` JSON state (`queued`, `layer1_running`, `layer2_running`, `completed`, `paused`, `unavailable`).
7. **`public.documents`**: Relational record ng bawat original at cropped ID file na in-upload para sa isang application (`ON DELETE CASCADE`).
8. **`public.screenings`**: Audit history ng bawat natapos na document screening (`quality`, `ocr`, `comparisons`, `ai_remark`).
9. **`public.corrections`**: History ng lahat ng automatic at manual `Needs Correction` requests at sagot ng customer.
10. **`public.notifications`**: In-app bell alerts na pwedeng naka-target sa specific `email` (gaya ng isang customer) o sa buong `role` (gaya ng sabay na alert sa lahat ng `agent` at `manager` kapag offline ang Auto-Screening).
11. **`public.login_history`**: Security log ng bawat sign-in ng lahat ng roles.
12. **`public.system_logs`**: Audit trail ng bawat system switch, status update, CMS edit, at account creation.
13. **`public.popup_guides`**: Bagong table na naglalaman ng title, intro, numbered `steps` (`JSONB`), `audience_tone` (`polite`, `professional`, `technical`), at `auto_show` flag para sa pop-up instructions ng lahat ng external at internal portals.

---

## 6. Complete Backend (`api/`) Code Walkthrough

### 6.1 `api/main.py` - FastAPI Server at REST Routes
Binubuksan ng `main.py` ang FastAPI app, sine-setup ang CORS, kinokonekta ang 5 API endpoints, at mina-mount ang `../web` static folder sa dulo:
- **`GET /health`**: Binabalik ang status ng `api`, `ollama`, `opencv`, `paddleocr`, `auto_screening_ready` (`bool(opencv_ok and ocr_ok)`), `active_screenings`, `smtp`, at `supabase_check`. Ginagamit ito ng Admin console at pati ng Agent/Manager dashboards (`checkAgentScreeningService` / `checkMgrScreeningService`) para malaman kung ready ang Auto-Screening.
- **`POST /screen-async`**: Tumatanggap ng `AsyncScreenRequest(application_id)` at ipinapasa agad sa `screening.enqueue_screening()` para tumakbo sa background thread pool.
- **`POST /screen`**: Direct upload fallback endpoint (`UploadFile`).
- **`POST /notify`**: Tumatanggap ng `EmailRequest` at tumatawag sa `mailer.send()` para sa lahat ng outgoing Gmail notifications.
- **`POST /polite-remark`**: Tumatawag sa `ai.write_polite_remark()` at `ai.detect_target_fields()` para sa Agent workspace.

### 6.2 `api/auth.py` - Bearer Token Verifier (`BaseTokenVerifier` -> `SupabaseTokenVerifier`)
Chine-check ang `Authorization: Bearer <token>` header gamit ang `_BEARER_REGEX` at kino-confirm sa Supabase `/auth/v1/user`. Kung walang session pa ang public applicant sa `apply.html` (halimbawa nagre-request ng Gmail OTP), ligtas itong pinapayagan bilang `{"public": True}`, habang vine-verify naman ang token ng naka-login na users.

### 6.3 `api/quality.py` - Image Quality at 4-Corner Auto-Crop (`BaseImageProcessor` Hierarchy)
- **`FastQualityScanner` (Layer 1)**: Kinukuwenta nang mabilis ang sharpness (`cv2.Laplacian(...).var()`), brightness (`gray.mean()`), at contrast (`gray.std()`).
- **`DocumentCropEnhancer` (Layer 2)**: Hinahanap ang 4 corners ng ID card (`_find_card_quad`), tinutuwid ang perspective (`_four_point_transform`), niro-rotate kung patayo ang kuha, o gumagamit ng Otsu bounding crop fallback (`_crop_bounding_card`). Pagkatapos ay nililinawan ang sulat gamit ang LAB + CLAHE (`_polish_color_image`) at ibinabalik ang `cropped_jpeg_bytes` para ma-upload sa `documents/cropped/`.

### 6.4 `api/ocr.py` - Optical Character Recognition (`BaseTextMatcher` -> `PaddleOcrService`)
Gumagamit ng `threading.Lock()` para ligtas kahit 4 threads ang sabay nagbabasa ng ID. Kinukumpara ng `compare(entered, lines)` ang `Full Name` (word-by-word fuzzy `SequenceMatcher >= 0.80`), `Birth Date` (normalized `YYYY-MM-DD` date extraction), at `ID Number` (alphanumeric stripped substring + sliding window similarity `>= 0.85`).

### 6.5 `api/ai.py` - Plain-Language Assistant (`BaseLanguageClient` -> `ScreeningLanguageAssistant`)
Gumagawa ng staff screening guidance (`write_guidance`) at magalang na 2-sentence customer message (`write_polite_remark`) gamit ang local Ollama (`qwen2.5:1.5b`) sa `http://localhost:11434`, na may deterministic rule-based templates kapag naka-off ang Ollama at `_TECH_TERMS_REGEX` sanitizer para walang technical terms na makalusot.

### 6.6 `api/screening.py` - 2-Layer Background Coordinator + Offline Fail-Safe
- **`SupabaseApplicationGateway`**: Humahawak ng lahat ng REST at Storage calls papuntang Supabase (`fetch_application`, `update_application`, `is_screening_enabled`, `download_id_bytes`, `upload_cropped_id`, `insert_notification`, `insert_correction_record`, `insert_screening_record`).
- **`BackgroundScreeningCoordinator`**:
  - **`_notify_staff_unavailable(ref_no, cust_name, reason_note)`**: May thread lock at 60-second cooldown (`_last_unavailable_alert_at`) para magpadala ng malinis na in-app notification sa parehong `role = 'agent'` at `role = 'manager'` kapag naka-pause o unavailable ang Auto-Screening.
  - **Fail-Safe Checks**: Bago at habang tumatakbo ang `_run_pipeline()`, chine-check kung:
    1. Naka-off ang `is_screening_enabled()` -> sine-set ang `state: "paused"`, `fallback_original_only: True`, `phase: "Original Copy Ready (Manual Review)"`, at nagno-notify sa Agents at Managers.
    2. Hindi available ang `quality.is_available()` o `ocr.is_available()`, o nagka-exception -> sine-set ang `state: "unavailable"`, `fallback_original_only: True`, pinapanatili ang original ID copy, at nagno-notify sa Agents at Managers.
  - **Layer 1 -> Layer 2 -> Auto-Correction**: Kapag online lahat, nagbibigay muna ng Layer 1 early advisory at ETA (`~20s remaining`), nagco-crop at nag-a-upload sa `documents/cropped/`, at kung may simpleng mismatch habang nasa `Pending Review` / `Under Agent Review`, kusang nagse-set ng `Needs Correction` at nagpapadala ng `correction_notice` email (kasama ang `target_summary`) sa customer.

### 6.7 `api/mailer.py` - Gmail SMTP Email Dispatcher
Kumokonekta sa `smtp.gmail.com:587` gamit ang `STARTTLS` at 16-character Google App Password. Sinusuportahan ang `otp`, `application_confirmation`, `correction_notice` (binabasa ang `target_summary` o `issue_category` nang walang sensitive ID leaks), `status_update`, `agent_alert`, `manager_alert`, at `promotional`.

---

## 7. Complete Frontend (`web/`) Code Walkthrough at Clean UI Structure

### 7.1 Shared Core (`config.js`, `db.js`, `api.js`, `dash-ui.js`, `style.css`)
- **`web/js/config.js`**:
  - Naglalaman ng `CONFIG`, `BaseFieldValidator` + `ApplicantFormValidator` (`FORM_VALIDATOR`), `DEFAULT_POPUP_GUIDES`, at ang OOP class na **`PopupGuideManager`** (`POPUP_GUIDE_MANAGER`).
  - **`showPortalGuide(guideId)`** at **`finishPortalGuide()`**: Nagre-render ng malinis na modal na may numbered `.guide-step-row` items para sa bawat portal.
  - **`openConfirmPopup(options)`**: Gumagawa ng explicit confirmation dialog bago i-toggle ang Maintenance Mode o AI Screening Engine para walang aksidenteng pag-off ng live website o screening.
- **`web/js/db.js`**:
  - Multi-tab isolated sessions (`pigem_session_customer`, `pigem_session_staff`, `pigem_session_admin`).
  - Bagong functions para sa pop-ups at fail-safe: **`dbSyncPopupGuides()`** (kumukuha ng active guides mula sa `public.popup_guides` at nagsi-sync sa `POPUP_GUIDE_MANAGER`), **`dbListPopupGuides()`**, **`dbSavePopupGuide()`**, at **`dbNotifyScreeningUnavailable(refNo, applicantName, detailNote)`** (nagpapadala ng session-deduplicated alert sa lahat ng `agent` at `manager` kapag hindi maabot ang Python server).
- **`web/js/api.js`**:
  - May 3.5-second `AbortController` timeout sa **`apiStartBackgroundScreening()`** at 3-second timeout sa **`apiCheckHealth()`** para hindi kailanman mag-hang ang UI kahit offline ang backend.
  - Ipina-forward ng **`apiSendCorrectionEmail()`** at **`apiSendStatusEmail()`** ang `targetSummary` (`target_summary`) papunta sa `POST /notify` para laging kumpleto ang detalye ng `Needs Correction` email.
- **`web/assets/style.css`**:
  - Nagbibigay ng `.section-card`, `.section-head`, `.step-badge`, `.status-banner`, `.guide-steps`, at `.check-pill-grid` para malinis, pantay-pantay, at madaling sundan ang bawat section sa lahat ng portals.

### 7.2 Public Pages (`index.html`, `about.html`, `apply.html`, `apply.js`)
- **`index.html` & `home.js`**: May **How to Apply** link sa navigation bar na nagbubukas ng `showPortalGuide('home_welcome')`, 4-banner slider, plan cards, at FAQs.
- **`apply.html` & `apply.js`**:
  - May **Application Guide** button sa header at automatic na tinatawag ang `POPUP_GUIDE_MANAGER.autoShowForPortal("apply_before_start")` pagka-verify ng CAPTCHA bago mag-fill up ang customer.
  - Lahat ng icons ay malinis na `.icon-placeholder` slots (walang emojis).
  - Sa `submitRegistration()`, kapag `screenRes.queued === false` (offline ang Python server o disabled), automatic na nilalagay ang `state: "unavailable"`, `fallback_original_only: true`, at tinatawag ang `dbNotifyScreeningUnavailable()` habang tuloy-tuloy na ipinapakita sa customer ang kanyang Reference Number.

### 7.3 Structured Staff, Customer, at Admin Portals
1. **`customer.html` & `customer.js`**:
   - May **Guide** button sa topbar (`customer_portal_guide`), 3 customer statuses lang (`Processing`, `Approved`, `Rejected`), at highlighted update form sa loob ng `Processing` kapag `Needs Correction`. May parehong offline fail-safe din sa `submitCustomerCorrection()`.
2. **`agent.html` & `agent.js` (Malinis na 4-Section Organized Workspace)**:
   - May `#agent-screening-banner` sa taas na automatic lumalabas (`checkAgentScreeningService()`) kapag naka-off o offline ang Auto-Screening para alam agad ng Agent na **Original Uploaded Photo** ang gagamitin niya.
   - Ang **Application Verification Modal (`renderDetailModalContent`)** ay hinati sa **4 malinaw na numbered `.section-card` blocks** para hindi nakakalito:
     - **`1. Applicant Profile & Installation Address`**: Plan, contact details, address, GPS coordinates, at switcher sa pagitan ng `Latest / Updated Copy` at `Original Submission`.
     - **`2. Valid ID Photos & Document Check`**: Switcher para sa `Cropped & Enhanced Copy` vs `Original Uploaded Photo` (automatic naka-default sa Original Copy kapag offline ang Auto-Screening), Download/Print ID buttons, at malinis na `.check-pill-grid` para sa Name, Birth Date, ID Number, at Photo Clarity.
     - **`3. Application Status & Validator Decision`**: Status selector (`Under Agent Review`, `Encoding`, `Approved`, `Rejected`, `Needs Correction`), internal notes, at iisang malinaw na **Save Status Update** button.
     - **`4. Optional: Request Customer Update (Needs Correction)`**: Collapsible box na may Validator Quick Presets, field selector, **Generate Polite Message** button, at sariling `#det-correction-message` box.
3. **`manager.html` & `manager.js`**:
   - Pinalitan lahat ng dating `"Content CMS"` ng malinaw na **`Website Content (CMS)`** / **`Content Management System (CMS)`**.
   - Pag-click sa CMS tabs (`cms-banners`, `cms-media`, `cms-about`, `cms-plans`, `cms-faqs`), **hindi na namamatay nang kusa ang public website**. Kung kailangang i-toggle ang Maintenance Mode, dadaan muna sa `openConfirmPopup()`.
   - May `#mgr-screening-banner` (`checkMgrScreeningService()`) at ayos na `saveMgrOverride()` na laging nagse-save ng `customer_instruction` at nagpapadala ng `apiSendCorrectionEmail()` kapag nag-set ng `Needs Correction` ang Manager.
4. **`admin.html` & `admin.js`**:
   - May **Technical Guide** button (`admin_technical_guide`), confirmation pop-ups bago baguhin ang **Maintenance Mode** (`toggleMaintMode`) at **AI Screening Engine** (`toggleAiMode`—na nagpapadala rin ng notification sa Agents at Managers kapag in-off), at bagong **Portal Pop-up Guides (`public.popup_guides`)** control table kung saan pwedeng i-preview at i-toggle ng Admin ang `Auto-Show` ng bawat portal guide.

---

## 8. Panel Defense Practice Questions (Self-Practice - Questions Only)

Gamitin ang mga tanong na ito para mag-ensayo sa sarili mong salita bago ang defense:

### A. System Architecture, Terms, at Operational Flow
1. Sa simpleng salita, ano ang pinagkaiba ng trabaho ng **Uvicorn** at ng **FastAPI** sa `api/main.py`, at ano ang ibig sabihin ng `http://127.0.0.1:8001`?
2. Ano ang pinagkaiba ng **Synchronous** at **Asynchronous** request, at bakit `POST /screen-async` ang ginamit pagka-submit ng application sa `apply.html`?
3. Paano gumagana ang `ThreadPoolExecutor(max_workers=4)` sa `api/screening.py` kapag maraming customers ang sabay-sabay na nag-submit ng application?
4. Ano ang ibig sabihin ng **CMS**, paano ito ginagamit ng Manager sa `manager.html`, at bakit hindi dapat kusang nag-o-off ang public website pagbukas pa lang ng CMS tab?
5. Ano ang mangyayari sa buong application process kapag biglang nawala o naka-off ang Auto-Screening / Python server? Paano nalalaman ng mga Agents at Managers, at anong kopya ng ID ang chine-check nila?
6. Paano gumagana ang **2-Layer Background Screening**, at ano ang pinagkaiba ng output ng Layer 1 sa Layer 2?
7. Paano gumagana ang `Needs Correction` email notification sa dalawang sitwasyon: kapag automatic na na-detect ng Layer 2 screening, at kapag manual na ni-request ng Agent o Manager?
8. Bakit tatlong main statuses lang (`Processing`, `Approved`, `Rejected`) ang nakikita ng customer sa `customer.html`, at bakit sa Admin portal (`admin.html`) lang nilagay ang technical terms gaya ng AI, OpenCV, PaddleOCR, at SMTP?
9. Paano gumagana ang bagong `public.popup_guides` table at bakit magkaiba ang tone ng pop-up instructions sa Customer/Agent/Manager kumpara sa Admin?

### B. Security, Email Transport, at Database Schema
10. Ano ang **SMTP**, para saan ang `Port 587` at `STARTTLS` sa `api/mailer.py`, at bakit **16-character Google App Password** ang ginagamit sa halip na regular Gmail password?
11. Ano ang **Bearer Token (`JWT`)**, at paano chine-check ng `SupabaseTokenVerifier` sa `api/auth.py` kung valid ang request?
12. Paano nasusunod ng system ang **Republic Act No. 10173 (Data Privacy Act of 2012)** sa local processing ng Valid IDs at sa laman ng `Needs Correction` emails?
13. Paano napananatili sa `public.applications` ang unang pinasa ng customer (`original_copy`) kahit mag-resubmit siya ng bagong detalye o ID photo (`corrected_copy`)?
14. Ano ang pinagkaiba ng dalawang Supabase Storage buckets na `website-assets` at `documents`, at saan napupunta ang auto-cropped ID ng Layer 2?
15. Para saan ang `CHECK` constraints at `CREATE INDEX` statements sa `schema.sql`, at bakit may `ON DELETE CASCADE` sa `documents`, `screenings`, at `corrections`?

### C. OOP, Regex, Nested Logic, at Code Details
16. Saan sa Python backend at JavaScript frontend kayo gumamit ng **Abstraction**, **Inheritance**, at **Encapsulation**? Magbigay ng konkretong class examples.
17. Saan-saan ginamit ang **Regular Expressions (Regex)** sa system, mula sa form validation hanggang sa OCR comparison at plain-language sanitization?
18. Paano sinusukat ng OpenCV sa `api/quality.py` kung malabo, madilim, o may flash glare ang ID photo, at paano nito tinutuwid at kino-crop ang 4 corners ng ID card?
19. Bakit gumamit ng `threading.Lock()` sa loob ng `PaddleOcrService` (`api/ocr.py`) at sa `_notify_staff_unavailable()` (`api/screening.py`)?
20. Paano sinisigurado ng `api/screening.py` na hindi nito mababago ang status ng application kung na-approve o na-encode na pala agad ng Agent habang patapos pa lang ang background screening?
