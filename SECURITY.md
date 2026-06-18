# Security Policy

This project is a local benchmark scaffold, not a production personal-data system. It intentionally models sensitive workflows, but it should not be run on real medical, financial, legal, or identity records without an independent privacy and security review.

## How to Report

Please open a private report through GitHub Security Advisories at
`https://github.com/jlov7/personal-ai-sovereignty-lab/security/advisories/new`.
For anything sensitive, prefer the private advisory over a public issue so it can
be triaged before disclosure. Non-sensitive concerns can also be raised as a
normal GitHub issue.

## Reportable Issues

Please report:

- Accidental inclusion of real personal data.
- Secrets, credentials, or private endpoint leakage.
- Unsafe instructions that encourage uploading sensitive records.
- Governance logic that permits raw sensitive data to cross a non-local boundary.
- Documentation that overstates privacy or security guarantees.

## Non-Claims

- The policy engine is a simulation, not an OS-level egress control.
- Consent state is modeled for evaluation and bound to keyed-integrity receipts (HMAC-SHA256 under a public fixture key) and a verifiable consent hash chain. This provides tamper-evidence and integrity, NOT authenticity/non-repudiation, and is not production key custody.
- No formal differential privacy, secure enclave, or cryptographic enforcement is provided.

## Supported Versions

Only the current mainline benchmark scaffold is supported. Older generated artifacts should be regenerated with:

```bash
pnpm eval
pnpm test
pnpm build
```
