import { app } from 'electron'

export function setAutoLaunch(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,  // Start minimized to tray on Windows
  })
}

export function getAutoLaunch(): boolean {
  return app.getLoginItemSettings().openAtLogin
}
