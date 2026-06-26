from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import detection, live

app = FastAPI(title="Car Detector API")

# Origins should be DOMAIN ONLY, no paths
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://object-detector-gray.vercel.app",  # ← Remove /health and /
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

@app.get("/api/status")
async def health():
    return {"status": "healthy"}