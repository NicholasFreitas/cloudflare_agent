interface Env {
  AI: Ai;
  THREAT_AGENT: DurableObjectNamespace<import("./src/index").ThreatAgent>;
}
