import os
from pathlib import Path
from pydantic_settings import BaseSettings


DATA_DIR = Path(os.environ.get("ESCO_DATA_DIR", Path(__file__).parent.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "chroma").mkdir(exist_ok=True)
(DATA_DIR / "credentials").mkdir(exist_ok=True)
(DATA_DIR / "logs").mkdir(exist_ok=True)


class Settings(BaseSettings):
    db_path: str = str(DATA_DIR / "esco.db")
    chroma_dir: str = str(DATA_DIR / "chroma")
    credentials_dir: str = str(DATA_DIR / "credentials")

    ollama_base_url: str = "http://localhost:11434"
    default_chat_model: str = "dolphin-phi3:latest"
    background_model: str = "phi3:mini"
    embed_model: str = "nomic-embed-text"

    slack_enabled: bool = False
    slack_bot_token: str = ""
    slack_app_token: str = ""
    default_agent_id: int = 1

    gmail_enabled: bool = False

    class Config:
        env_file = str(DATA_DIR / ".env")
        env_file_encoding = "utf-8"


settings = Settings()
