require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const activeRequests = new Map();
const DEFAULT_AGENT_URL = 'http://localhost:8787';

function createWindow() {
  const window = new BrowserWindow({
    width: 1120,
    height: 800,
    minWidth: 840,
    minHeight: 640,
    backgroundColor: '#07111f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(__dirname, 'index.html'));
}

async function summarizeArticle(_event, input) {
  if (!input || typeof input.text !== 'string' || !input.text.trim()) {
    throw new Error('Paste article text before requesting a summary.');
  }

  const agentUrl = process.env.THREAT_AGENT_URL || DEFAULT_AGENT_URL;
  const requestId = typeof input.requestId === 'string' ? input.requestId : '';
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 90000);
  if (requestId) activeRequests.set(requestId, controller);

  let response;
  try {
    response = await fetch(
      `${agentUrl.replace(/\/$/, '')}/api/analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: input.text, sessionId: input.sessionId || 'desktop-default' }),
        signal: controller.signal
      }
    );
  } catch (error) {
    if (timedOut) {
      throw new Error('The Agent took longer than 90 seconds. Check that Wrangler is running and try again.');
    }
    if (error?.name === 'AbortError') throw new Error('Analysis canceled.');
    throw new Error(`Could not reach the Agent at ${agentUrl}. Start Wrangler or check THREAT_AGENT_URL.`);
  } finally {
    clearTimeout(timeout);
    if (requestId) activeRequests.delete(requestId);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The Agent returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `The Agent returned HTTP ${response.status}.`);
  }
  return payload;
}

app.whenReady().then(() => {
  ipcMain.handle('article:summarize', summarizeArticle);
  ipcMain.handle('article:cancel', (_event, requestId) => {
    const controller = activeRequests.get(requestId);
    if (!controller) return false;
    controller.abort();
    return true;
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
