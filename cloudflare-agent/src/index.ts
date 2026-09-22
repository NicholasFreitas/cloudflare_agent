import { Agent, callable, routeAgentRequest } from "agents";

type ThreatLevel = "low" | "medium" | "high" | "critical" | "unknown";

export type Assessment = {
  threatLevel: ThreatLevel;
  breachType: string;
  reportedResponsibleParty: string;
  responsibilityType: string;
  articleAuthorship: "human" | "ai" | "mixed" | "unknown";
  confidence: number;
  summary: string;
  signals: string[];
  evidence: string[];
  uncertainties: string[];
  reasoning: string;
  analyzedAt: string;
};

type AgentState = {
  assessmentHistory: Assessment[];
  lastAssessment?: Assessment;
};

type AnalyzeInput = {
  text?: string;
};

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function parseAssessment(raw: unknown): Assessment {
  if (typeof raw === "object" && raw !== null) {
    return raw as Assessment;
  }
  if (typeof raw !== "string") {
    throw new Error("Workers AI returned an unreadable assessment. Try a shorter article or different source.");
  }
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const candidates = [cleaned];
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(cleaned.slice(objectStart, objectEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Assessment;
    } catch {
      // Try the next representation when the model adds prose around JSON.
    }
  }
  throw new Error("Workers AI returned an unreadable assessment. Try a shorter article or different source.");
}

function promptFor(article: string) {
  return `You are a careful cybersecurity intelligence analyst. Return ONLY valid JSON with this exact shape:
{
  "threatLevel": "low" | "medium" | "high" | "critical" | "unknown",
  "breachType": "short label",
  "reportedResponsibleParty": "the party the article says is responsible, or Not identified",
  "responsibilityType": "criminal_group | state_actor | insider | accidental | unknown",
  "articleAuthorship": "human" | "ai" | "mixed" | "unknown",
  "confidence": 0.0,
  "summary": "two concise sentences",
  "signals": ["specific observable signals"],
  "evidence": ["claims explicitly supported by the article"],
  "uncertainties": ["unverified attribution or missing facts"],
  "reasoning": "brief explanation for the threat level"
}

Separate who reportedly caused the breach from who wrote the article. Never infer AI authorship from tone alone. Treat attribution as a reported claim, not proven fact, unless the article cites strong evidence. Use low confidence and explain uncertainty when the source is speculative.

Article:
${article}`;
}

async function readArticle(input: AnalyzeInput): Promise<string> {
  const text = input.text?.trim();
  if (!text) throw new Error("Provide article text.");
  return text.slice(0, 30000);
}

export class ThreatAgent extends Agent<Env, AgentState> {
  initialState: AgentState = { assessmentHistory: [] };

  @callable()
  async analyze(input: AnalyzeInput): Promise<Assessment> {
    const article = await readArticle(input);
    const result = await this.env.AI.run(MODEL, {
      messages: [
        { role: "system", content: "Return valid JSON only. Do not use markdown fences." },
        { role: "user", content: promptFor(article) }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1000
    });

    const raw = typeof result === "object" && result !== null && "response" in result
      ? (result as { response: unknown }).response
      : "";
    if (!raw) throw new Error("Workers AI returned no assessment.");

    const assessment = parseAssessment(raw);
    assessment.analyzedAt = new Date().toISOString();
    this.setState({
      assessmentHistory: [...this.state.assessmentHistory, assessment].slice(-20),
      lastAssessment: assessment
    });
    return assessment;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze" && request.method === "POST") {
      try {
        const input = await request.json<AnalyzeInput & { sessionId?: string }>();
        const sessionId = input.sessionId?.trim() || "desktop-default";
        const agent = env.THREAT_AGENT.getByName(sessionId);
        const assessment = await agent.analyze(input);
        return Response.json(assessment);
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Assessment failed." }, { status: 400 });
      }
    }
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
