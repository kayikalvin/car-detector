# Deploy FastAPI Car Detector to Render

## Prerequisites
- Render account (free tier available at render.com)
- GitHub repository with your project
- The `render.yaml` file already in your repo

## Step 1: Push Code to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - car detector app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Step 2: Connect GitHub to Render

1. Go to **render.com** and sign up/log in
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. Click **"Connect account"** and authorize GitHub
5. Search for your repository and select it
6. Click **"Connect"**

## Step 3: Configure the Web Service

### Name & Region
- **Name**: `car-detector-api` (matches render.yaml)
- **Region**: `Oregon` (or your preferred region)
- **Branch**: `main`

### Build & Deploy
- **Environment**: `Docker`
- **Dockerfile Path**: `./backend/Dockerfile`
- **Plan**: `Free` (or upgrade if needed)

### Environment Variables (Optional but Recommended)
Add these in the dashboard:
```
CONFIDENCE_THRESHOLD=0.5
```

## Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Build the Docker image
   - Deploy the service
3. Wait for deployment (3-5 minutes)
4. You'll get a URL like: `https://car-detector-api.onrender.com`

## Step 5: Update CORS Origins

Once you have your Render URL, update `backend/app/main.py`:

```python
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://your-frontend-vercel-url.vercel.app",
    "https://car-detector-api.onrender.com",  # Add this
]
```

Then push to GitHub:
```bash
git add backend/app/main.py
git commit -m "Update CORS origins for Render deployment"
git push
```

Render will automatically redeploy when you push.

## Step 6: Verify Deployment

Test your API endpoints:

```bash
# Health check
curl https://car-detector-api.onrender.com/health

# Root endpoint
curl https://car-detector-api.onrender.com/

# Test image detection (replace with actual image path)
curl -X POST https://car-detector-api.onrender.com/detect/image \
  -F "file=@/path/to/image.jpg"
```

## Step 7: Frontend Configuration

Update your frontend API base URL in `frontend/src/api.js`:

```javascript
const API_BASE_URL = 'https://car-detector-api.onrender.com';
// or use environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://car-detector-api.onrender.com';
```

In `frontend/.env`:
```
VITE_API_URL=https://car-detector-api.onrender.com
```

## Troubleshooting

### Build Fails
- Check logs in Render dashboard: **Logs** tab
- Ensure Dockerfile is correct
- Verify all dependencies in `requirements.txt`

### Model Not Found
- The `yolov8n.pt` file must be in `backend/app/models/`
- Docker volume mounts persist it across restarts
- If missing, ultralytics will auto-download on first run (slower)

### WebSocket Timeout
- Render's free tier may have connection limits
- Consider upgrading plan for production
- Set reasonable WebSocket timeout in client

### Memory Issues
- Free tier has 512 MB RAM
- YOLOv8n is lightweight but video processing is memory-intensive
- Monitor usage in **Metrics** tab
- Upgrade plan if needed

### Slow Initial Startup
- First deployment builds the image
- Subsequent deploys reuse cached layers
- Model loading takes ~10-20 seconds
- Normal behavior

## Advanced: Manual YAML Configuration

If the dashboard doesn't work, create `render.yaml` in repo root:

```yaml
services:
  - type: web
    name: car-detector-api
    env: docker
    region: oregon
    plan: free
    branch: main
    dockerfilePath: ./backend/Dockerfile
    buildCommand: ""  # Uses Dockerfile
    startCommand: ""  # Uses Dockerfile CMD
    envVars:
      - key: CONFIDENCE_THRESHOLD
        value: "0.5"
    healthCheckPath: /health
```

Then connect repo to Render and it will auto-detect `render.yaml`.

## Important Notes

1. **Free Tier Limitations**:
   - Service spins down after 15 min of inactivity
   - Cold start takes 30-60 seconds
   - Limited resources
   
2. **Upgrade to Production**:
   - For always-on service: Standard plan ($7/month)
   - For high traffic: consider Pro plan

3. **Video Processing**:
   - Large videos may timeout on free tier
   - Keep video size reasonable (<50MB)
   - Increase request timeout if needed

4. **Database** (future):
   - Render also offers PostgreSQL
   - Use for storing detection history

## Monitoring & Logs

After deployment, monitor:
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, request count
- **Health**: Automatic health checks via `/health` endpoint

Access these from the Render dashboard.

---

**Your API is now live!** 🚀