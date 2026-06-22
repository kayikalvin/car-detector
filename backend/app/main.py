from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import detection, live

app = FastAPI(title="Car Detector API")

# Update with your Vercel frontend domain after deployment
origins = [
    "http://localhost:5173",
    "https://your-app.vercel.app",   # <-- replace with your real Vercel URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detection.router)
app.include_router(live.router)

@app.get("/")
async def root():
    return {"message": "Car Detector API is running."}

@app.get("/health")
async def health():
    return {"status": "healthy"}