import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('escoAPI', {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  openFile: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFile'),

  getDataPath: (): Promise<string> =>
    ipcRenderer.invoke('app:getDataPath'),

  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),

  onBackendLog: (callback: (line: string) => void) => {
    ipcRenderer.on('backend:log', (_event, line) => callback(line))
  },
  onBackendReady: (callback: () => void) => {
    ipcRenderer.on('backend:ready', () => callback())
  },
  onBackendError: (callback: (msg: string) => void) => {
    ipcRenderer.on('backend:error', (_event, msg) => callback(msg))
  },
})

export type EscoAPI = {
  openFolder: () => Promise<string | null>
  openFile: () => Promise<string | null>
  getDataPath: () => Promise<string>
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => void
  onBackendLog: (callback: (line: string) => void) => void
  onBackendReady: (callback: () => void) => void
  onBackendError: (callback: (msg: string) => void) => void
}
