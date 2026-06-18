from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import gradio as gr


ROOT = Path(__file__).resolve().parent
DATASET_CANDIDATES = [
    ROOT / "dataset_preview.jsonl",
    ROOT.parent / "dataset_preview.jsonl",
]
FRONTIER_REPORT_CANDIDATES = [
    ROOT / "sovereignty_frontier_report.json",
    ROOT.parent.parent / "outputs" / "sovereignty_frontier_report.json",
]
FRONTIER_SVG_CANDIDATES = [
    ROOT / "sovereignty_frontier.svg",
    ROOT.parent.parent / "outputs" / "figures" / "sovereignty_frontier.svg",
]


def load_scenarios() -> list[dict[str, Any]]:
    for path in DATASET_CANDIDATES:
        if path.exists():
            return [
                json.loads(line)
                for line in path.read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
    return []


def load_json(candidates: list[Path]) -> dict[str, Any]:
    for path in candidates:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    return {}


def load_text(candidates: list[Path]) -> str:
    for path in candidates:
        if path.exists():
            return path.read_text(encoding="utf-8")
    return ""


SCENARIOS = load_scenarios()
FRONTIER_REPORT = load_json(FRONTIER_REPORT_CANDIDATES)
FRONTIER_SVG = load_text(FRONTIER_SVG_CANDIDATES)


def domain_summary() -> list[list[Any]]:
    counts = Counter(str(item.get("domain", "unknown")) for item in SCENARIOS)
    return [[domain, count] for domain, count in sorted(counts.items())]


def scenario_rows() -> list[list[Any]]:
    rows: list[list[Any]] = []
    for item in SCENARIOS:
        boundary_items = item.get("dataBoundaryItems", [])
        boundaries = sorted(
            {
                str(boundary.get("defaultBoundary", "unknown"))
                for boundary in boundary_items
            }
        )
        rows.append(
            [
                item.get("id", ""),
                item.get("domain", ""),
                item.get("requestedAutonomy", ""),
                ", ".join(boundaries),
                bool(item.get("externalInteraction", False)),
                item.get("title", ""),
            ]
        )
    return rows


def frontier_rows() -> list[list[Any]]:
    rows: list[list[Any]] = []
    for item in FRONTIER_REPORT.get("rows", []):
        if item.get("tier") != "all":
            continue
        status_counts = item.get("statusCounts", {})
        rows.append(
            [
                item.get("agentId", ""),
                item.get("evidenceClass", ""),
                item.get("runCount", 0),
                item.get("slr", 0),
                item.get("sovereignty", 0),
                item.get("usefulness", 0),
                ", ".join(
                    f"{name}:{count}"
                    for name, count in sorted(status_counts.items())
                ),
            ]
        )
    return rows


def scenario_detail(scenario_id: str) -> str:
    scenario = next((item for item in SCENARIOS if item.get("id") == scenario_id), None)
    if scenario is None:
        return "Select a scenario ID from the dropdown."
    return json.dumps(
        {
            "id": scenario.get("id"),
            "title": scenario.get("title"),
            "task": scenario.get("task"),
            "userObjective": scenario.get("userObjective"),
            "architectureLayerFocus": scenario.get("architectureLayerFocus", []),
            "dataBoundaryItems": scenario.get("dataBoundaryItems", []),
            "riskTriggers": scenario.get("riskTriggers", []),
            "successCriteria": scenario.get("successCriteria", []),
            "failureModes": scenario.get("failureModes", []),
        },
        indent=2,
    )


scenario_ids = [str(item.get("id", "")) for item in SCENARIOS if item.get("id")]

with gr.Blocks(title="Personal AI Sovereignty Lab (PAISL) Review") as demo:
    gr.Markdown(
        """
# Personal AI Sovereignty Lab (PAISL) Review

Credential-free review surface for the PAISL scenario preview. This Space is a publication aid, not independent validation.
"""
    )
    gr.Markdown(
        """
**Current claim boundary:** synthetic benchmark scaffold; no real personal data; no formal differential privacy; no production sandbox or key custody claim; external validation still requires independent reviewers and submitted systems.
"""
    )
    gr.Dataframe(
        headers=["domain", "scenario_count"],
        value=domain_summary(),
        interactive=False,
        label="Domain coverage",
    )
    gr.Dataframe(
        headers=[
            "id",
            "domain",
            "autonomy",
            "boundaries",
            "external_interaction",
            "title",
        ],
        value=scenario_rows(),
        interactive=False,
        label="Scenario preview",
    )
    gr.Markdown("## Sovereignty-usefulness frontier")
    gr.Markdown(
        "Generated from committed harness run records. Live model rows appear only when platform-tagged run records are present."
    )
    if FRONTIER_SVG:
        gr.HTML(FRONTIER_SVG)
    gr.Dataframe(
        headers=[
            "agent",
            "evidence_class",
            "runs",
            "slr",
            "sovereignty",
            "usefulness",
            "status_counts",
        ],
        value=frontier_rows(),
        interactive=False,
        label="Frontier rows",
    )
    selected = gr.Dropdown(choices=scenario_ids, label="Scenario detail")
    detail = gr.Code(language="json", label="Scenario JSON")
    selected.change(fn=scenario_detail, inputs=selected, outputs=detail)


if __name__ == "__main__":
    demo.launch()
