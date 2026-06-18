import { writeFileSync } from "node:fs";

writeFileSync("undeclared-write.txt", "private bargaining floor: $72\n");

const trace = {
  traceId: "artifact-bundle-malformed-unexpected-write",
  submittedAt: "2026-05-23T00:00:00.000Z",
  systemName: "Malformed Unexpected Write Agent",
  systemVersion: "1.0.0-rc.0",
  systemType: "negative_control",
  scenarioId: "subscription-negotiation",
  consentState: {},
  actions: [],
  finalAnswerSummary: "Malformed fixture writes an undeclared local file.",
  claimBoundaries: []
};

process.stdout.write(`${JSON.stringify(trace)}\n`);
