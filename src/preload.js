const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('threatDesk', {
  summarize: (input) => ipcRenderer.invoke('article:summarize', input),
  cancelSummary: (requestId) => ipcRenderer.invoke('article:cancel', requestId)
});
