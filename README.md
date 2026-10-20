# Esco Playground

A desktop app where several local AI personas share one chat. You create agents with a name, a picture, a list of
skills and a model from Ollama, then invite them to a conversation. Mention one with `@` and it replies. If its reply
mentions another agent, that one answers too. Everything runs on your own machine.

Prototype (v0.1), built in one day in June 2026. It was the starting point for my personal assistant, Abril.
Case study: https://dev.luitiescobar.com/work/esco-playground/

## What's inside

- **Electron** shell with a tray icon that starts and supervises the backend.
- **React + TypeScript + Vite + Tailwind** interface: chat, agents, memories, models and logs.
- **FastAPI** backend (SQLAlchemy + aiosqlite) that streams replies token by token from **Ollama**.
- **Per-agent memory:** after each conversation a small model pulls out facts and stores them in a SQLite full-text
  index. The relevant ones come back in the next prompt. You can view, add and delete them from the UI.
- **Persona consistency:** a short example exchange at the start of every prompt plus memories injected as an
  assistant note keep each agent in character on small local models.

Calendar and the model cookbook are placeholders. Slack and Gmail appear only as settings; they are not implemented.

## Run it (Windows)

You need Node.js, Python 3 and [Ollama](https://ollama.com) with at least one chat model pulled, for example:

```bash
ollama pull phi3:mini
ollama pull nomic-embed-text
```

```bash
pip install -r requirements.txt
npm install
cd frontend && npm install && cd ..
npm run dev
```

Or double-click `EscoPlayground.bat`. Your data (database, avatars) is stored in `data/`, which is git-ignored.

## Author

Luiti Escobar · https://dev.luitiescobar.com
