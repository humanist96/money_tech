"""FastAPI server exposing NotebookLM functionality as REST API."""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from notebooklm_service import NotebookLMService

service = NotebookLMService()


def _restore_auth_from_env():
    """Write NOTEBOOKLM_AUTH_JSON env var to storage_state.json for Railway/Cloud."""
    auth_json = os.environ.get("NOTEBOOKLM_AUTH_JSON")
    if not auth_json:
        return
    home = Path(os.environ.get("NOTEBOOKLM_HOME", Path.home() / ".notebooklm"))
    home.mkdir(parents=True, exist_ok=True)
    storage_path = home / "storage_state.json"
    if not storage_path.exists():
        storage_path.write_text(auth_json)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _restore_auth_from_env()
    yield
    await service.close()


app = FastAPI(
    title="MoneyTech NotebookLM API",
    description="REST API for Google NotebookLM integration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Models ---


class CreateNotebookRequest(BaseModel):
    title: str


class AddSourceUrlRequest(BaseModel):
    url: str


class AddSourceTextRequest(BaseModel):
    title: str
    content: str


class ChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


class GenerateAudioRequest(BaseModel):
    format: str = "deep-dive"


class GenerateReportRequest(BaseModel):
    report_type: str = "briefing"


class CreateResearchRequest(BaseModel):
    keyword: str
    youtube_urls: list[str]
    analysis_text: str = ""


# --- Auth ---


@app.get("/api/auth/status")
async def auth_status():
    return await service.check_auth()


@app.post("/api/auth/login")
async def auth_login():
    result = await service.login()
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Login failed"))
    return result


# --- Notebooks ---


@app.post("/api/notebooks")
async def create_notebook(req: CreateNotebookRequest):
    try:
        return await service.create_notebook(req.title)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebooks")
async def list_notebooks():
    try:
        return await service.list_notebooks()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebooks/{notebook_id}")
async def get_notebook(notebook_id: str):
    try:
        return await service.get_notebook(notebook_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/notebooks/{notebook_id}")
async def delete_notebook(notebook_id: str):
    try:
        return await service.delete_notebook(notebook_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Sources ---


@app.post("/api/notebooks/{notebook_id}/sources/url")
async def add_source_url(notebook_id: str, req: AddSourceUrlRequest):
    try:
        return await service.add_source_url(notebook_id, req.url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notebooks/{notebook_id}/sources/text")
async def add_source_text(notebook_id: str, req: AddSourceTextRequest):
    try:
        return await service.add_source_text(notebook_id, req.title, req.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebooks/{notebook_id}/sources")
async def list_sources(notebook_id: str):
    try:
        return await service.list_sources(notebook_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Chat ---


@app.post("/api/notebooks/{notebook_id}/chat")
async def chat(notebook_id: str, req: ChatRequest):
    try:
        return await service.chat(notebook_id, req.question, req.conversation_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebooks/{notebook_id}/chat/history")
async def chat_history(notebook_id: str):
    try:
        return await service.get_chat_history(notebook_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Audio ---


@app.post("/api/notebooks/{notebook_id}/audio")
async def generate_audio(notebook_id: str, req: GenerateAudioRequest):
    try:
        return await service.generate_audio(notebook_id, req.format)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebooks/{notebook_id}/audio/{artifact_id}/status")
async def audio_status(notebook_id: str, artifact_id: str):
    try:
        return await service.get_audio_status(notebook_id, artifact_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notebooks/{notebook_id}/audio/{artifact_id}/download")
async def download_audio(notebook_id: str, artifact_id: str):
    try:
        data = await service.download_audio(notebook_id, artifact_id)
        return Response(content=data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Reports / Quiz / Study Guide ---


@app.post("/api/notebooks/{notebook_id}/report")
async def generate_report(notebook_id: str, req: GenerateReportRequest):
    try:
        return await service.generate_report(notebook_id, req.report_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notebooks/{notebook_id}/quiz")
async def generate_quiz(notebook_id: str):
    try:
        return await service.generate_quiz(notebook_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notebooks/{notebook_id}/study-guide")
async def generate_study_guide(notebook_id: str):
    try:
        return await service.generate_study_guide(notebook_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- High-level: Research Notebook ---


@app.post("/api/notebooks/research")
async def create_research_notebook(req: CreateResearchRequest):
    try:
        return await service.create_research_notebook(
            req.keyword, req.youtube_urls, req.analysis_text
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
