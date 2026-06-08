import json
import logging
from typing import AsyncIterator
import httpx
from config import settings

logger = logging.getLogger("esco.ollama")


class OllamaClient:
    def __init__(self):
        # Streaming client — used only for generate_stream
        self._stream_client = httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=120.0)

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
            async with self._stream_client.stream("POST", "/api/chat", json=payload) as resp:
                # Read status without touching body — safe inside stream context
                if resp.status_code >= 400:
                    await resp.aread()  # consume body so we can read it
                    error_text = resp.text
                    raise httpx.HTTPStatusError(
                        f"HTTP {resp.status_code}: {error_text}",
                        request=resp.request,
                        response=resp,
                    )
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
            # e.response.text is safe now (we called aread above before raising)
            logger.error(f"Ollama HTTP error: {e}")
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
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=30.0) as client:
            resp = await client.post("/api/embeddings", json={"model": model, "prompt": text})
            resp.raise_for_status()
            return resp.json()["embedding"]

    async def list_models(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=5.0) as client:
                resp = await client.get("/api/tags")
                resp.raise_for_status()
                return resp.json().get("models", [])
        except Exception:
            return []

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=2.0) as client:
                resp = await client.get("/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self._stream_client.aclose()


ollama = OllamaClient()
