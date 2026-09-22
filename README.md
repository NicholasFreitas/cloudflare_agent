# Threat Desk

Threat Desk is a two-part AI-powered security intelligence application:

- `cloudflare-agent/` is a stateful [Cloudflare Agent](https://developers.cloudflare.com/agents/) deployed on Workers.
- `src/` is an Electron desktop client that sends pasted article text to the Agent.

The Agent uses a Workers AI binding, coordinates article analysis, and persists the last 20 assessments in its Durable Object state. The Electron application has no Cloudflare API token.

It displays:

- a threat level (`low`, `medium`, `high`, or `critical`)
- the breach type
- the reported responsible party and responsibility category
- whether the article has evidence of human, AI, mixed, or unknown authorship
- a short summary, signals, and reasoning
- confidence, evidence, and uncertainties

## Interview or demo setup

For a hosted demonstration, the normal flow is:

```text
Install prerequisites
    -> install dependencies
    -> log in to Cloudflare
    -> deploy the Agent (only needed after backend changes)
    -> configure the deployed Worker URL
    -> start Electron
```

You do **not** need to run `npm run agent:dev` when using the deployed Worker. That command is only for local backend development.

### One-time machine setup

Open PowerShell in the repository root (`E:\cloudflase_agent`).

1. Install Node.js 22 or newer. Wrangler 4 requires Node.js 22:

   ```powershell
   node --version
   npm --version
   ```

2. Install the Electron and Agent dependencies:

   ```powershell
   npm install
   npm install --prefix cloudflare-agent
   ```

3. Authenticate Wrangler with Cloudflare:

   ```powershell
   npx wrangler login --cwd cloudflare-agent
   ```

   A browser window opens. Complete the login using the Cloudflare account that owns the Worker and has Workers AI enabled.

### Deploy or update the Cloudflare Agent

Run this after the first setup and after any changes under `cloudflare-agent/`:

```powershell
npm.cmd run deploy --prefix cloudflare-agent
```

Copy the Worker URL printed by Wrangler. It will look similar to:

```text
https://threat-desk-agent.<your-subdomain>.workers.dev
```

### Configure Electron

Create a local `.env` file in the repository root. This file is ignored by Git and should not be committed:

```powershell
Copy-Item .env.example .env
```

Set the deployed URL in `.env`:

```env
THREAT_AGENT_URL=https://threat-desk-agent.<your-subdomain>.workers.dev
```

If `.env` is absent, Electron falls back to `http://localhost:8787`.

### Start the interview demo

Start Electron from the repository root:

```powershell
npm start
```

Then demonstrate:

1. Paste a breach report into **Article text**.
2. Click **Analyze threat**.
3. Show the threat level, breach type, reported responsible party, evidence, confidence, and uncertainties.
4. Explain that the reported responsible party is treated as an attribution claim, not automatically as verified fact.
5. Click **Cancel analysis** during a long request to demonstrate request cancellation.

### Verify the hosted Agent before opening Electron

This optional smoke test confirms the deployed Worker and Workers AI binding are healthy:

```powershell
$body = @{
  text = "A ransomware group reportedly encrypted production systems and stole customer records."
  sessionId = "interview-smoke-test"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://threat-desk-agent.<your-subdomain>.workers.dev/api/analyze" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

The response should be a JSON assessment. If it fails, fix the hosted Agent before starting the Electron demo.

## Local backend development

Use this workflow when developing the Agent without deploying each change:

Terminal 1:

```powershell
npm run agent:dev
```

Wrangler starts the Agent at `http://localhost:8787`.

Terminal 2:

```powershell
Copy-Item .env.example .env
# Keep THREAT_AGENT_URL=http://localhost:8787 in .env
npm start
```

After changing the Agent code, Wrangler reloads it locally. After changing Electron code, restart `npm start`.

## Troubleshooting

### `Could not reach the Agent`

- Confirm the hosted Worker URL in `.env`.
- Restart Electron after changing `.env`; environment variables are read when Electron starts.
- Verify the URL with the smoke test above.
- For local development, confirm `npm run agent:dev` is still running.

### `No such model`

Redeploy the Agent after model changes:

```powershell
npm.cmd run deploy --prefix cloudflare-agent
```

The Agent uses the currently configured Workers AI model identifier in [cloudflare-agent/src/index.ts](./cloudflare-agent/src/index.ts).

### `Workers AI returned an unreadable assessment`

Try a shorter article or a relevant excerpt. The Agent limits input length and expects structured JSON from Workers AI.

### Node.js version errors

Wrangler requires Node.js 22 or newer:

```powershell
node --version
```

Upgrade Node.js and reopen PowerShell before reinstalling dependencies.

### `npm.ps1 cannot be loaded`

Use `npm.cmd` in PowerShell:

```powershell
npm.cmd install
npm.cmd run deploy --prefix cloudflare-agent
```

## Assignment mapping

1. **LLM:** `ThreatAgent.analyze` calls Llama 3.3 70B FP8 Fast through the Workers AI binding.
2. **Workflow / coordination:** the Agent coordinates text normalization, AI extraction, reconciliation, and durable state persistence in one request. The boundary can be moved to Cloudflare Workflows if long-running or approval steps are added.
3. **User input:** Electron provides a desktop chat-style analysis form accepting pasted reporting.
4. **Memory/state:** `ThreatAgent` is a Durable Object-backed Agent and stores assessment history.

The attribution schema intentionally distinguishes the article's authorship from the article's reported responsible party. Attribution is presented as a claim with evidence, confidence, and uncertainty rather than as verified fact.

See [PROMPT-HISTORY.md](./PROMPT-HISTORY.md) for the AI-assisted development prompt history requested by the application.
