from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import engine, Base
from .routers import diet, workout, sleep, config, scores

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Health Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diet.router, prefix="/api")
app.include_router(workout.router, prefix="/api")
app.include_router(sleep.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(scores.router, prefix="/api")

# Serve built React frontend if it exists
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        index = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(index)

    @app.get("/", include_in_schema=False)
    def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
