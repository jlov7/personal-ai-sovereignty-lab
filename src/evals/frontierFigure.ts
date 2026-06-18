import type { SovereigntyFrontierReport, SovereigntyFrontierRow } from "./sovereigntyFrontierReport";

const WIDTH = 1040;
const HEIGHT = 650;
const PLOT = {
  left: 88,
  top: 108,
  width: 570,
  height: 376
};
const PANEL = {
  left: 700,
  top: 96,
  width: 292,
  height: 522
};
const COLORS = ["#8250df", "#1f6feb", "#2da44e", "#d1242f", "#bf8700", "#0969da"];
const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coord(value: number): string {
  return value.toFixed(2);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function axisX(usefulness: number): number {
  return PLOT.left + usefulness * PLOT.width;
}

function axisY(sovereignty: number): number {
  return PLOT.top + (1 - sovereignty) * PLOT.height;
}

function plottedRows(report: SovereigntyFrontierReport): SovereigntyFrontierRow[] {
  return report.rows
    .filter((row) => row.tier === "all")
    .sort(
      (a, b) =>
        b.sovereignty - a.sovereignty ||
        b.usefulness - a.usefulness ||
        b.runCount - a.runCount ||
        a.agentId.localeCompare(b.agentId)
    );
}

function displayName(agentId: string): string {
  if (agentId === "reference-policy") {
    return "Reference policy";
  }
  if (agentId === "boundary-usefulness-control") {
    return "Usefulness control";
  }
  if (agentId === "centralized-negative-control") {
    return "Negative control";
  }
  if (agentId.startsWith("openai-compatible:")) {
    return agentId.replace("openai-compatible:", "Live local run: ").replace(":26b", " 26B");
  }
  return agentId;
}

function evidenceLabel(row: SovereigntyFrontierRow): string {
  const status = row.statusCounts.completed === row.runCount ? "completed" : "unfinished";
  const evidence = row.evidenceClass === "live_model" ? "live model" : "fixture";
  return `${evidence}; n=${row.runCount}; ${status}`;
}

function textLines({
  x,
  y,
  lines,
  size = 12,
  weight = "400",
  fill = "#57606a",
  anchor = "start",
  lineHeight = 17
}: {
  x: number;
  y: number;
  lines: string[];
  size?: number;
  weight?: string;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  lineHeight?: number;
}): string {
  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${coord(x)}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("");
  return `<text x="${coord(x)}" y="${coord(y)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${spans}</text>`;
}

function pointCode(agentId: string): string {
  if (agentId === "reference-policy") {
    return "REF";
  }
  if (agentId === "boundary-usefulness-control") {
    return "USE";
  }
  if (agentId === "centralized-negative-control") {
    return "LEAK";
  }
  if (agentId.startsWith("openai-compatible:")) {
    return "LIVE";
  }
  return "ROW";
}

function panelRow(row: SovereigntyFrontierRow, index: number): string {
  const y = PANEL.top + 60 + index * 66;
  const color = COLORS[index % COLORS.length];
  const code = pointCode(row.agentId);
  const name = displayName(row.agentId);
  const metrics = `${percent(row.usefulness)} task / ${percent(row.sovereignty)} boundary`;
  return [
    `<g data-agent-summary="${escapeXml(row.agentId)}">`,
    `<circle cx="${PANEL.left + 18}" cy="${coord(y - 3)}" r="15" fill="${color}" stroke="#1f2328" stroke-width="1.4"/>`,
    `<text x="${PANEL.left + 18}" y="${coord(y + 1)}" font-family="${FONT}" font-size="8.5" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(code)}</text>`,
    textLines({
      x: PANEL.left + 44,
      y: y - 10,
      lines: [name, metrics, evidenceLabel(row)],
      size: 10.5,
      weight: "700",
      fill: "#1f2328",
      lineHeight: 15
    }),
    `</g>`
  ].join("\n  ");
}

function panelRows(rows: SovereigntyFrontierRow[]): string {
  return rows.map((row, index) => panelRow(row, index)).join("\n  ");
}

function markerTextSize(code: string): number {
  return code.length > 3 ? 8.5 : 9.5;
}

function marker(row: SovereigntyFrontierRow, index: number): string {
  const x = axisX(row.usefulness);
  const y = axisY(row.sovereignty);
  const color = COLORS[index % COLORS.length];
  const radius = row.evidenceClass === "live_model" ? 18 : 17;
  const code = pointCode(row.agentId);
  if (row.agentId === "reference-policy") {
    return [
      `<g data-agent="${escapeXml(row.agentId)}">`,
      `<title>${escapeXml(`${displayName(row.agentId)}: task completion ${percent(row.usefulness)}, boundary score ${percent(row.sovereignty)}, ${evidenceLabel(row)}`)}</title>`,
      `<circle cx="${coord(x)}" cy="${coord(y)}" r="${radius}" fill="${color}" stroke="#1f2328" stroke-width="1.6"/>`,
      `<text x="${coord(x)}" y="${coord(y + 3)}" font-family="${FONT}" font-size="${markerTextSize(code)}" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(code)}</text>`,
      `</g>`
    ].join("\n  ");
  }
  return [
    `<g data-agent="${escapeXml(row.agentId)}">`,
    `<title>${escapeXml(`${displayName(row.agentId)}: task completion ${percent(row.usefulness)}, boundary score ${percent(row.sovereignty)}, ${evidenceLabel(row)}`)}</title>`,
    `<circle cx="${coord(x)}" cy="${coord(y)}" r="${radius}" fill="${color}" stroke="#1f2328" stroke-width="1.6"/>`,
    `<text x="${coord(x)}" y="${coord(y + 3)}" font-family="${FONT}" font-size="${markerTextSize(code)}" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(code)}</text>`,
    `</g>`
  ].join("\n  ");
}

export function renderSovereigntyFrontierSvg(report: SovereigntyFrontierReport): string {
  const rows = plottedRows(report);
  const gridTicks = [0, 0.25, 0.5, 0.75, 1];
  const grid = gridTicks
    .flatMap((tick) => {
      const x = axisX(tick);
      const y = axisY(tick);
      return [
        `<line x1="${coord(x)}" y1="${coord(PLOT.top)}" x2="${coord(x)}" y2="${coord(
          PLOT.top + PLOT.height
        )}" stroke="#d8dee4" stroke-width="1"/>`,
        `<line x1="${coord(PLOT.left)}" y1="${coord(y)}" x2="${coord(PLOT.left + PLOT.width)}" y2="${coord(
          y
        )}" stroke="#d8dee4" stroke-width="1"/>`,
        `<text x="${coord(x)}" y="${coord(PLOT.top + PLOT.height + 28)}" text-anchor="middle">${tick.toFixed(
          2
        )}</text>`,
        `<text x="${coord(PLOT.left - 18)}" y="${coord(y + 4)}" text-anchor="end">${tick.toFixed(2)}</text>`
      ];
    })
    .join("\n  ");
  const markers = rows.map((row, index) => marker(row, index)).join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">PAISL boundary-control chart</title>
  <desc id="desc">Control chart where x is task completion and y is boundary score, defined as one minus SLR.</desc>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
  <text x="42" y="40" font-family="${FONT}" font-size="23" font-weight="750" fill="#1f2328">Boundary-control chart</text>
  <text x="42" y="66" font-family="${FONT}" font-size="13" fill="#57606a">Shows whether a run source avoids confirmed raw leaks while still completing objective task checks.</text>
  <g font-family="${FONT}" font-size="11" fill="#57606a">
  ${grid}
  </g>
  <rect x="${PLOT.left}" y="${PLOT.top}" width="${PLOT.width}" height="${PLOT.height}" rx="3" fill="#f6f8fa" fill-opacity="0.38" stroke="#1f2328" stroke-width="1.4"/>
  <text x="${coord(PLOT.left + PLOT.width / 2)}" y="${coord(PLOT.top + PLOT.height + 58)}" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="middle" fill="#1f2328">Task completion score</text>
  <text x="${coord(PLOT.left + PLOT.width / 2)}" y="${coord(PLOT.top + PLOT.height + 78)}" font-family="${FONT}" font-size="11" text-anchor="middle" fill="#57606a">mean share of objective success checks satisfied</text>
  <text x="26" y="${coord(PLOT.top + PLOT.height / 2)}" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="middle" fill="#1f2328" transform="rotate(-90 26 ${coord(
    PLOT.top + PLOT.height / 2
  )})">Boundary score</text>
  <text x="48" y="${coord(PLOT.top + PLOT.height / 2)}" font-family="${FONT}" font-size="11" text-anchor="middle" fill="#57606a" transform="rotate(-90 48 ${coord(
    PLOT.top + PLOT.height / 2
  )})">one minus confirmed raw-leak rate</text>
  <g font-family="${FONT}" fill="#1f2328">
  ${markers}
  </g>
  <rect x="${PANEL.left - 18}" y="${PANEL.top - 12}" width="${PANEL.width + 36}" height="${PANEL.height}" rx="8" fill="#ffffff" stroke="#d0d7de"/>
  ${textLines({
    x: PANEL.left,
    y: PANEL.top + 14,
    lines: ["Rows"],
    size: 14,
    weight: "750",
    fill: "#1f2328"
  })}
  ${panelRows(rows)}
  ${textLines({
    x: PANEL.left,
    y: PANEL.top + 330,
    lines: ["Axes"],
    size: 14,
    weight: "750",
    fill: "#1f2328"
  })}
  ${textLines({
    x: PANEL.left,
    y: PANEL.top + 362,
    lines: ["X: task completion, measured", "as mean objective success", "checks satisfied."],
    fill: "#57606a"
  })}
  ${textLines({
    x: PANEL.left,
    y: PANEL.top + 432,
    lines: ["Y: boundary score, measured", "as one minus the confirmed", "raw-leak rate."],
    fill: "#57606a"
  })}
  <text x="42" y="604" font-family="${FONT}" font-size="12" fill="#57606a">Sparse corners are expected: these are control rows, not a model leaderboard.</text>
  <text x="42" y="626" font-family="${FONT}" font-size="12" fill="#57606a">Evidence shown: ${report.hermeticRunCount} fixture runs; ${report.liveModelRunCount} platform-tagged live run.</text>
</svg>
`;
}
