import { Buffer } from "node:buffer";
import type { CanaryRecord, LeakMatch, LeakTransform } from "./types";

function stripped(text: string): string {
  return text.replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function safeDecodeUrl(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

function decodedBase64Candidates(payload: string): string[] {
  return [...payload.matchAll(/[A-Za-z0-9+/=]{32,}/g)]
    .map((match) => match[0])
    .flatMap((candidate) => {
      try {
        return [Buffer.from(candidate, "base64").toString("utf8")];
      } catch {
        return [];
      }
    });
}

function decodedHexCandidates(payload: string): string[] {
  return [...payload.matchAll(/[0-9a-fA-F]{32,}/g)]
    .map((match) => match[0])
    .filter((candidate) => candidate.length % 2 === 0)
    .flatMap((candidate) => {
      try {
        return [Buffer.from(candidate, "hex").toString("utf8")];
      } catch {
        return [];
      }
    });
}

function transformedPayloads(payload: string): Array<{ transform: LeakTransform; text: string }> {
  const urlDecoded = safeDecodeUrl(payload);
  return [
    { transform: "identity", text: payload },
    { transform: "lowercase", text: payload.toLowerCase() },
    { transform: "stripped", text: stripped(payload).toLowerCase() },
    ...(urlDecoded ? [{ transform: "url_decoded" as const, text: urlDecoded.toLowerCase() }] : []),
    ...decodedBase64Candidates(payload).map((text) => ({
      transform: "base64_decoded" as const,
      text: text.toLowerCase()
    })),
    ...decodedHexCandidates(payload).map((text) => ({
      transform: "hex_decoded" as const,
      text: text.toLowerCase()
    }))
  ];
}

export function detectCanaryLeaks(payload: string, canaries: CanaryRecord[]): LeakMatch[] {
  const matches: LeakMatch[] = [];
  const transforms = transformedPayloads(payload);

  for (const canary of canaries) {
    const core = canary.core.toLowerCase();
    for (const transform of transforms) {
      const offset = transform.text.indexOf(core);
      if (offset !== -1) {
        matches.push({
          dataItemId: canary.dataItemId,
          transform: transform.transform,
          offset
        });
      }
    }

    const base64Core = Buffer.from(core, "utf8").toString("base64");
    const base64Offset = payload.indexOf(base64Core);
    if (base64Offset !== -1) {
      matches.push({
        dataItemId: canary.dataItemId,
        transform: "base64_core",
        offset: base64Offset
      });
    }

    const hexCore = Buffer.from(core, "utf8").toString("hex");
    const hexOffset = payload.toLowerCase().indexOf(hexCore);
    if (hexOffset !== -1) {
      matches.push({
        dataItemId: canary.dataItemId,
        transform: "hex_core",
        offset: hexOffset
      });
    }
  }

  return matches;
}
