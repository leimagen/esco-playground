import json
import logging
from typing import AsyncIterator
import httpx
from config import settings

logger = logging.getLogger("esco.ollama")


class OllamaClient:
    def __init__(self):
        self._client = httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=120.0)

    async def generate_stream(
        self,
        model: str,
        messages: list[dict],
        system: str | None = None,
        images: list[str] | None = None,
    ) -> AsyncIterator[str]:
        payload: dict = {"model": model, "messages": messages, "stream": True}
        if system:
            payload["system"] = system
        if images:
            payload["images"] = images

        try:
            async with self._client.stream("POST", "/api/chat", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            yield token
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
        except httpx.HTTPStatusError as e:
            logger.error(f"Ollama HTTP error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            raise

    async def generate_sync(
        self,
        model: str,
        messages: list[dict],
        system: str | None = None,
    ) -> str:
        result = []
        async for token in self.generate_stream(model, messages, system):
            result.append(token)
        return "".join(result)

    async def embed(self, model: str, text: str) -> list[float]:
        resp = await self._client.post("/api/embeddings", json={"model": model, "prompt": text})
        resp.raise_for_status()
        return resp.json()["embedding"]

    async def list_models(self) -> list[dict]:
        try:
            resp = await self._client.get("/api/tags")
            resp.raise_for_status()
            return resp.json().get("models", [])
        except Exception:
            return []

    async def is_available(self) -> bool:
        try:
            resp = await self._client.get("/api/tags", timeout=2.0)
            return resp.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self._client.aclose()


ollama = OllamaClient()
