---
title: Personal AI Sovereignty Lab (PAISL) Review
sdk: gradio
app_file: app.py
license: mit
pinned: false
---

# Personal AI Sovereignty Lab (PAISL) Review Space

This directory is a credential-free Hugging Face Space template for reviewing the PAISL scenario preview and public claim boundaries.

## Files

- `app.py`: Gradio review interface.
- `requirements.txt`: minimal Space dependency list.
- `dataset_preview.jsonl`: synthetic scenario preview records from the curated scored suite plus generated public corpus.
- `sovereignty_frontier_report.json`: committed frontier rows generated from harness run records.
- `sovereignty_frontier.svg`: committed frontier figure.

For a standalone Space root, copy the contents of this directory into the Space. No API token or secret should be stored in the Space files.

## Non-Claims

- This Space is a review surface, not an independent validation result.
- It does not run private models or paid APIs.
- It does not contain real personal data.
- It must not be used to upload private user records.

## Launch Checklist

1. Create a maintainer-controlled Hugging Face Space.
2. Copy `app.py`, `requirements.txt`, `dataset_preview.jsonl`, `sovereignty_frontier_report.json`, and `sovereignty_frontier.svg` into the Space root.
3. Link back to the GitHub repository and `docs/claim_evidence_index.md`.
4. Open a GitHub issue with the public Space URL.
5. Keep validation language blocked until outside reviewers submit annotations, critiques, or baselines.
