import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

export class ProcessManager extends EventEmitter {
  private backendProcess: ChildProcess | null = null
  private ollamaProcess: ChildProcess | null = null
  private dataDir: string

  constructor() {
    super()
    this.dataDir = path.join(app.getPath('userData'), 'data')
    this.ensureDataDir()
  }

  private ensureDataDir() {
    const dirs = [
      this.dataDir,
      path.join(this.dataDir, 'chroma'),
      path.join(this.dataDir, 'credentials'),
      path.join(this.dataDir, 'logs'),
    ]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  async start() {
    this.log('Starting Esco Playground services...')
    await this.startOllama()
    await this.startBackend()
    await this.waitForBackend()
  }

  private async startOllama() {
    const isRunning = await this.checkPort(11434)
    if (isRunning) {
      this.log('Ollama already running on port 11434')
      return
    }

    this.log('Starting Ollama...')
    const ollamaCmd = process.platform === 'win32' ? 'ollama.exe' : 'ollama'

    this.ollamaProcess = spawn(ollamaCmd, ['serve'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    this.ollamaProcess.stdout?.on('data', (data: Buffer) => {
      this.log(`[ollama] ${data.toString().trim()}`)
    })
    this.ollamaProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) this.log(`[ollama] ${msg}`)
    })
    this.ollamaProcess.on('error', (err) => {
      this.log(`[ollama] Failed to start: ${err.message}. Install from https://ollama.ai`)
      this.emit('error', 'Ollama not found. Please install it from https://ollama.ai')
    })

    await this.waitForPort(11434, 15000)
    this.log('Ollama ready')
  }

  private async startBackend() {
    const isRunning = await this.checkPort(8000)
    if (isRunning) {
      this.log('Backend already running on port 8000')
      return
    }
    this.log('Starting Python backend...')

    const isDev = !app.isPackaged
    const backendDir = isDev
      ? path.join(process.cwd(), 'backend')
      : path.join(process.resourcesPath, 'backend')

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

    const env = {
      ...process.env,
      ESCO_DATA_DIR: this.dataDir,
      PYTHONUNBUFFERED: '1',
    }

    if (isDev) {
      this.backendProcess = spawn(
        pythonCmd,
        ['-m', 'uvicorn', 'main:app', '--port', '8000', '--reload', '--log-level', 'info'],
        {
          cwd: backendDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
        }
      )
    } else {
      const exePath = path.join(process.resourcesPath, 'esco-backend.exe')
      this.backendProcess = spawn(exePath, ['--port', '8000'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      })
    }

    this.backendProcess.stdout?.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach((line) => {
        this.log(`[backend] ${line}`)
      })
    })
    this.backendProcess.stderr?.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach((line) => {
        this.log(`[backend] ${line}`)
      })
    })
    this.backendProcess.on('error', (err) => {
      this.log(`[backend] Error: ${err.message}`)
      this.emit('error', `Backend failed: ${err.message}`)
    })
    this.backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        this.log(`[backend] Exited with code ${code}`)
      }
    })
  }

  private async waitForBackend() {
    this.log('Waiting for backend to be ready...')
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch('http://localhost:8000/api/health', {
          signal: AbortSignal.timeout(1000),
        })
        if (res.ok) {
          this.log('Backend ready on port 8000')
          this.emit('ready')
          return
        }
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    this.emit('error', 'Backend did not start within 30 seconds')
  }

  private async checkPort(port: number): Promise<boolean> {
    try {
      const res = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(500),
      })
      return res.status < 500
    } catch {
      return false
    }
  }

  private async waitForPort(port: number, timeout: number): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await this.checkPort(port)) return
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  async stop() {
    this.log('Shutting down services...')
    try {
      await fetch('http://localhost:8000/api/shutdown', {
        method: 'POST',
        signal: AbortSignal.timeout(2000),
      })
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 1500))

    if (this.backendProcess && !this.backendProcess.killed) {
      this.backendProcess.kill('SIGTERM')
    }
    await new Promise((r) => setTimeout(r, 500))

    if (this.ollamaProcess && !this.ollamaProcess.killed) {
      this.ollamaProcess.kill('SIGTERM')
    }
  }

  private log(msg: string) {
    const timestamp = new Date().toISOString().slice(11, 19)
    const line = `[${timestamp}] ${msg}`
    console.log(line)
    this.emit('log', line)
  }
}
