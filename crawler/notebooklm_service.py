"""NotebookLM service wrapper using notebooklm-py library."""

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class NotebookInfo:
    id: str
    title: str
    source_count: int
    created_at: str


@dataclass
class SourceInfo:
    id: str
    title: str
    source_type: str
    status: str


@dataclass
class ChatResponse:
    answer: str
    references: list[dict]
    conversation_id: str


@dataclass
class ArtifactInfo:
    id: str
    artifact_type: str
    status: str
    title: str | None = None
    download_url: str | None = None


class NotebookLMService:
    """Wraps notebooklm-py to provide business logic for the API."""

    def __init__(self):
        self._client = None

    async def _get_client(self):
        if self._client is None:
            from notebooklm import NotebookLMClient
            self._client = NotebookLMClient()
            await self._client.__aenter__()
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.__aexit__(None, None, None)
            self._client = None

    async def check_auth(self) -> dict:
        """Check if authentication is valid."""
        try:
            client = await self._get_client()
            notebooks = await client.notebooks.list()
            return {"authenticated": True, "notebook_count": len(notebooks)}
        except Exception as e:
            return {"authenticated": False, "error": str(e)}

    async def login(self) -> dict:
        """Trigger browser-based login."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "notebooklm", "login",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                return {"success": True, "message": "Login completed"}
            return {"success": False, "error": stderr.decode()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # --- Notebook CRUD ---

    async def create_notebook(self, title: str) -> dict:
        client = await self._get_client()
        nb = await client.notebooks.create(title)
        return {"id": nb.id, "title": nb.title}

    async def list_notebooks(self) -> list[dict]:
        client = await self._get_client()
        notebooks = await client.notebooks.list()
        return [
            {
                "id": nb.id,
                "title": nb.title,
            }
            for nb in notebooks
        ]

    async def get_notebook(self, notebook_id: str) -> dict:
        client = await self._get_client()
        nb = await client.notebooks.get(notebook_id)
        sources = await client.sources.list(notebook_id)
        return {
            "id": nb.id,
            "title": nb.title,
            "sources": [
                {
                    "id": s.id,
                    "title": s.title,
                    "type": getattr(s, "source_type", "unknown"),
                    "status": getattr(s, "status", "ready"),
                }
                for s in sources
            ],
        }

    async def delete_notebook(self, notebook_id: str) -> dict:
        client = await self._get_client()
        await client.notebooks.delete(notebook_id)
        return {"deleted": True}

    # --- Source Management ---

    async def add_source_url(self, notebook_id: str, url: str) -> dict:
        client = await self._get_client()
        source = await client.sources.add_url(notebook_id, url)
        return {"id": source.id, "title": source.title}

    async def add_source_text(
        self, notebook_id: str, title: str, content: str
    ) -> dict:
        client = await self._get_client()
        source = await client.sources.add_text(notebook_id, title, content)
        return {"id": source.id, "title": source.title}

    async def list_sources(self, notebook_id: str) -> list[dict]:
        client = await self._get_client()
        sources = await client.sources.list(notebook_id)
        return [
            {
                "id": s.id,
                "title": s.title,
                "type": getattr(s, "source_type", "unknown"),
                "status": getattr(s, "status", "ready"),
            }
            for s in sources
        ]

    # --- Chat ---

    async def chat(
        self,
        notebook_id: str,
        question: str,
        conversation_id: Optional[str] = None,
    ) -> dict:
        client = await self._get_client()
        result = await client.chat.ask(
            notebook_id,
            question,
            conversation_id=conversation_id,
        )
        return {
            "answer": result.answer,
            "references": [
                {
                    "source_id": getattr(ref, "source_id", None),
                    "text": getattr(ref, "text", ""),
                }
                for ref in getattr(result, "references", [])
            ],
            "conversation_id": result.conversation_id,
        }

    async def get_chat_history(self, notebook_id: str) -> list[dict]:
        client = await self._get_client()
        history = await client.chat.get_history(notebook_id)
        return [
            {
                "role": getattr(msg, "role", "unknown"),
                "content": getattr(msg, "content", ""),
            }
            for msg in history
        ]

    # --- Artifacts (Audio, Reports, Quiz, etc.) ---

    async def generate_audio(
        self, notebook_id: str, format: str = "deep-dive"
    ) -> dict:
        client = await self._get_client()
        artifact = await client.artifacts.generate_audio(
            notebook_id, format=format
        )
        return {
            "id": artifact.id,
            "status": getattr(artifact, "status", "generating"),
        }

    async def get_audio_status(self, notebook_id: str, artifact_id: str) -> dict:
        client = await self._get_client()
        artifact = await client.artifacts.get(notebook_id, artifact_id)
        status = getattr(artifact, "status", "unknown")
        result = {"id": artifact.id, "status": status}
        if status == "completed":
            result["download_url"] = f"/api/notebooks/{notebook_id}/audio/{artifact_id}/download"
        return result

    async def download_audio(self, notebook_id: str, artifact_id: str) -> bytes:
        client = await self._get_client()
        data = await client.artifacts.download_audio(notebook_id, artifact_id)
        return data

    async def generate_report(
        self, notebook_id: str, report_type: str = "briefing"
    ) -> dict:
        client = await self._get_client()
        if report_type == "study_guide":
            artifact = await client.artifacts.generate_study_guide(notebook_id)
        else:
            artifact = await client.artifacts.generate_report(notebook_id)
        content = getattr(artifact, "content", getattr(artifact, "text", ""))
        return {
            "id": getattr(artifact, "id", ""),
            "content": content,
            "type": report_type,
        }

    async def generate_quiz(self, notebook_id: str) -> dict:
        client = await self._get_client()
        artifact = await client.artifacts.generate_quiz(notebook_id)
        questions = getattr(artifact, "questions", [])
        return {
            "id": getattr(artifact, "id", ""),
            "questions": [
                {
                    "question": getattr(q, "question", ""),
                    "options": getattr(q, "options", []),
                    "answer": getattr(q, "answer", ""),
                    "explanation": getattr(q, "explanation", ""),
                }
                for q in questions
            ],
        }

    async def generate_study_guide(self, notebook_id: str) -> dict:
        client = await self._get_client()
        artifact = await client.artifacts.generate_study_guide(notebook_id)
        return {
            "id": getattr(artifact, "id", ""),
            "content": getattr(artifact, "content", getattr(artifact, "text", "")),
        }

    # --- High-level: Create research notebook from search results ---

    async def create_research_notebook(
        self,
        keyword: str,
        youtube_urls: list[str],
        analysis_text: str,
    ) -> dict:
        """Create a notebook with YouTube sources and analysis text."""
        from datetime import datetime

        title = f"{keyword} 투자 분석 - {datetime.now().strftime('%Y.%m.%d')}"
        client = await self._get_client()

        nb = await client.notebooks.create(title)
        notebook_id = nb.id

        added_sources = []

        # Add YouTube URLs as sources
        for url in youtube_urls[:5]:
            try:
                source = await client.sources.add_url(notebook_id, url)
                added_sources.append({"id": source.id, "title": source.title, "type": "youtube"})
            except Exception:
                pass

        # Add analysis text as a source
        if analysis_text:
            try:
                source = await client.sources.add_text(
                    notebook_id,
                    f"{keyword} AI 분석 리포트",
                    analysis_text,
                )
                added_sources.append({"id": source.id, "title": source.title, "type": "text"})
            except Exception:
                pass

        return {
            "id": notebook_id,
            "title": title,
            "sources": added_sources,
        }
