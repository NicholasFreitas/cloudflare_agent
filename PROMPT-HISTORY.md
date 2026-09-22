# Prompt history

This file records the AI-assisted prompts used while building Threat Desk, as requested by the Cloudflare application assignment.

## Product direction

> Build a small Electron desktop app that uses Cloudflare Agents and Workers AI to assess breach reporting. Return a threat level, breach type, reported responsible party, evidence, confidence, and uncertainty. Do not present unverified attribution as fact.

## Architecture

> Convert the prototype into a two-part application: an Electron client with no Cloudflare API credentials, and a Cloudflare Agent backend using a Workers AI binding, Durable Object state, and an explicit multi-step assessment boundary.

## Safety and attribution

> Distinguish article authorship from the party reportedly responsible for the breach. Require evidence for attribution, expose confidence and uncertainties, and use unknown when the article does not support a conclusion.

## Implementation

> Add a deployable Cloudflare Agent Worker with an /api/analyze endpoint, pasted text input, Workers AI JSON output, durable assessment history, and a documented local development workflow.
