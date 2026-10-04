# Hosting & Deployment Guide — Deepak Hotels Group

This project is a zero-dependency Node.js web application equipped with all necessary GitHub workflow and cloud deployment configuration files.

---

## Files Added for GitHub & Hosting

| File | Purpose |
| :--- | :--- |
| [`.github/workflows/ci.yml`](file:///c:/Users/arnav/Downloads/files..2/.github/workflows/ci.yml) | Automated GitHub Actions CI workflow for syntax & server healthcheck testing |
| [`package.json`](file:///c:/Users/arnav/Downloads/files..2/package.json) | Node.js manifest with `npm start` script, engine requirement, and health check script |
| [`.gitignore`](file:///c:/Users/arnav/Downloads/files..2/.gitignore) | Excludes sensitive environment files, logs, and `node_modules` from Git |
| [`.env.example`](file:///c:/Users/arnav/Downloads/files..2/.env.example) | Template for environment variables (`PORT`, `NODE_ENV`, `DATA_DIR`) |
| [`Procfile`](file:///c:/Users/arnav/Downloads/files..2/Procfile) | Web process specification for Heroku / Render / Dokku / Caprover |
| [`render.yaml`](file:///c:/Users/arnav/Downloads/files..2/render.yaml) | Render.com 1-click blueprint with persistent storage disk configuration |
| [`Dockerfile`](file:///c:/Users/arnav/Downloads/files..2/Dockerfile) | Production-ready lightweight Docker image container configuration |
| [`.dockerignore`](file:///c:/Users/arnav/Downloads/files..2/.dockerignore) | Prevents unnecessary files from swelling Docker container image build context |
| [`vercel.json`](file:///c:/Users/arnav/Downloads/files..2/vercel.json) | Route configuration for Vercel serverless platform hosting |

---

## 📦 Step-by-Step GitHub Setup

Follow these steps to push your project to a new GitHub repository:

1. **Initialize Git & Make Initial Commit** (Already prepared locally):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Deepak Hotels Group booking platform"
   git branch -M main
   ```

2. **Create a New Repository on GitHub**:
   - Go to [GitHub New Repository](https://github.com/new).
   - Enter Repository Name: `deepak-hotels-group`.
   - Leave options (Add README / gitignore) **unchecked** as we already have them locally.
   - Click **Create repository**.

3. **Link & Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/deepak-hotels-group.git
   git push -u origin main
   ```

---

## 🚀 Recommended Free Hosting Options

### Option 1: Render.com (Recommended — 100% Free Tier Compatible)

The app is fully configured for Render. Because all database tables are hosted in **Supabase Cloud (PostgreSQL)** and media files are stored in **Supabase Cloud Storage**, your bookings, room updates, menu items, and photos/videos are permanently preserved even across Render server restarts and redeploys!

#### Method A: New Web Service (Standard & Fastest)
1. Sign up or log in to [Render.com](https://render.com/).
2. Click **New +** (top right) → **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect your repository (`deepak-hotels-group`).
4. Set the following settings:
   - **Name**: `deepak-hotels-group` (or your choice)
   - **Region**: Choose the closest region (e.g., *Singapore* or *Frankfurt*)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Expand **Advanced** (at the bottom):
   - **Health Check Path**: `/api/health`
   - **Auto-Deploy**: `Yes`
6. Click **Add Environment Variable** to add:
   - `SUPABASE_URL`: `https://wfxoyzrocifvtlopevjq.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-supabase-service-role-key` (From Supabase Dashboard -> Project Settings -> API -> service_role secret)
   - `SUPABASE_ANON_KEY`: `sb_publishable_f_MCpE0P8l_4a51dBFsAXQ_sOM0DDSO`
   - `NODE_ENV`: `production`
   *(Note: Built-in fallbacks are also bundled, but setting them in the Render dashboard ensures high reliability).*
7. Click **Create Web Service**. Render will build and deploy your site in ~1 minute.
8. Your site is live at: `https://deepak-hotels-group.onrender.com` (free SSL included)!

#### Method B: Blueprint (1-Click Deploy via `render.yaml`)
1. In Render, click **New +** → **Blueprint**.
2. Connect your Git repository.
3. Render reads `render.yaml` automatically and configures the web service, Node 22 runtime, and healthcheck.
4. Click **Apply**.

---

### Option 2: Railway.app (Fastest 1-Click Container Deployment)

1. Sign up on [Railway.app](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select `deepak-hotels-group`.
4. Railway auto-detects `Dockerfile` or `package.json` and deploys automatically.
5. In project settings, add a **Volume** mounted at `/app/data` to persist booking data.
6. Under **Networking**, click **Generate Domain** to get your public HTTPS URL.

---

### Option 3: VPS / Docker Hosting (DigitalOcean, AWS, Linode, Hetzner)

Run the container on any Linux server with Docker installed:

1. **Build Docker image**:
   ```bash
   docker build -t deepak-hotels-group .
   ```
2. **Run container with persistent data volume**:
   ```bash
   docker run -d \
     --name deepak-hotels-group \
     -p 80:3000 \
     -v $(pwd)/data:/app/data \
     --restart unless-stopped \
     deepak-hotels-group
   ```
3. Access your site live at `http://YOUR_SERVER_IP`.

---

## 🔒 Pre-Deployment Checklist

Before making your site live for real guests:
1. **Change Default Admin Credentials**:
   - Access `/admin` in your browser.
   - Or change the seeded password hash in [`server.js`](file:///c:/Users/arnav/Downloads/files..2/server.js).
2. **Health Check Endpoint**:
   - Your server includes an automated uptime monitoring route at `/api/health` returning `200 OK`.
