import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.routers import upload, structure, pace, generate, quick, flag, regenerate, cost, structure_edit, ingest
from app.storage import purge_old_sessions

limiter = Limiter(key_func=get_remote_address)


async def _purge_loop():
    while True:
        await asyncio.sleep(30 * 60)  # every 30 minutes
        purge_old_sessions()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_purge_loop())
    yield
    task.cancel()


app = FastAPI(title="LessonGrove API", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"(https://.*\.(vercel\.app|onrender\.com)|http://localhost:\d+)",
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(upload.router)
app.include_router(structure.router)
app.include_router(pace.router)
app.include_router(generate.router)
app.include_router(quick.router)
app.include_router(flag.router)
app.include_router(regenerate.router)
app.include_router(cost.router)
app.include_router(structure_edit.router)
app.include_router(ingest.router)


@app.get("/")
async def root():
    return {"service": "LessonGrove API", "status": "ok", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}
