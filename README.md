# PIGEM Web-Based Internet Service Application System
**With Two-Layer Background Document Screening**

Developed for **PIGEM Combined Facilities Support Services** (Dasmariñas City, Cavite) - Residential Red Fiber Broadband Applications.

---

## 1. Prerequisites and Downloading Required Technologies

Run these simple commands in **PowerShell** or **Command Prompt** when setting up the system on a new Windows computer:

### Step 1: Install Python 3.11
PaddleOCR requires Python 3.11. Install it from [python.org](https://www.python.org/downloads/release/python-3119/) (check **"Add Python to PATH"**) or via Windows Package Manager:
```powershell
winget install Python.Python.3.11
```

### Step 2: Install Ollama and Download the Local AI Model
Install [Ollama](https://ollama.com/download) or run:
```powershell
winget install Ollama.Ollama
```
Then download the `qwen2.5:1.5b` language model used for plain-language screening notes and polite customer remarks:
```powershell
ollama pull qwen2.5:1.5b
```

### Step 3: Create the Virtual Environment and Install Python Libraries
Open PowerShell inside `C:\pigem-system\api` to download `FastAPI`, `Uvicorn`, `OpenCV`, and `PaddleOCR`:
```powershell
cd C:\pigem-system\api
py -3.11 -m venv .venv311
.\.venv311\Scripts\activate
pip install -r requirements.txt
```

### Step 4: Set Up Environment Variables (`api\.env`)
Copy `.env.example` to `.env` inside `C:\pigem-system\api`:
```powershell
copy .env.example .env
```
Fill in your Supabase URL/Anon Key and your Gmail address + 16-character Google App Password in `api\.env`.

### Step 5: Set Up the Supabase Database
Open your **Supabase Dashboard -> SQL Editor**, paste the contents of `schema.sql`, select all (`Ctrl + A`), and click **Run**.

---

## 2. How to Start the System

### Step 1: Start Local Ollama Service
Open a terminal window and run:
```powershell
ollama run qwen2.5:1.5b
```

### Step 2: Start the Web and API Server
Double-click **`START-AI.bat`** in `C:\pigem-system`, or run manually in PowerShell:
```powershell
cd C:\pigem-system\api
.\.venv311\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

### Step 3: Open the System in Your Browser
- **Home Page:** http://127.0.0.1:8001/index.html
- **Online Application Form:** http://127.0.0.1:8001/apply.html
- **Customer Login:** http://127.0.0.1:8001/login.html
- **Customer Account Portal:** http://127.0.0.1:8001/customer.html
- **Staff Login (Agent / Manager):** http://127.0.0.1:8001/staff-login.html
- **Agent Portal:** http://127.0.0.1:8001/agent.html
- **Manager Portal:** http://127.0.0.1:8001/manager.html
- **Admin Login:** http://127.0.0.1:8001/admin-login.html
- **Admin Portal:** http://127.0.0.1:8001/admin.html
- **Admin and Manager Account Setup:** http://127.0.0.1:8001/setup-accounts.html

---

## 3. Project Structure

- `START-AI.bat` - Starts the FastAPI web and screening server on `http://127.0.0.1:8001`
- `schema.sql` - PostgreSQL database tables, indexes, RLS policies, and storage bucket setup for Supabase
- `api/` - Python FastAPI backend (`main.py`, `screening.py`, `quality.py`, `ocr.py`, `ai.py`, `mailer.py`, `auth.py`, `requirements.txt`)
- `web/` - Frontend HTML portals, `assets/style.css`, and `js/` client scripts
