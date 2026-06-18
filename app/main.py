from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import upload, structure, pace, generate, quick


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # no DB to init; session store is a module-level dict


app = FastAPI(title="LessonGrove API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(structure.router)
app.include_router(pace.router)
app.include_router(generate.router)
app.include_router(quick.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
