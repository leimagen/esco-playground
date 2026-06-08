import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import * as path from 'path'

let tray: Tray | null = null

export function setupTray(mainWindow: BrowserWindow) {
  const iconPath = path.join(__dirname, '../resources/icon.ico')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Esco Playground')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Esco Playground',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
