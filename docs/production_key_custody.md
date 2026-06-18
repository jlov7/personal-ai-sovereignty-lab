# Production Key Custody Non-Claims

Status: design note and non-claim boundary.

PAISL tests consent semantics with keyed-integrity tags (HMAC-SHA256 under a public committed fixture key) so the benchmark can be reproduced locally. These tags provide tamper-evidence, not authenticity or non-repudiation, and they are not signatures that bind an identity. That is useful for evals. It is not production key custody.

## Custody Variants

| Variant | Production Shape | Main Risk | Required Control |
| --- | --- | --- | --- |
| User-held key | User controls signing authority on a device or hardware token. | Loss, coercion, phishing, and hard recovery tradeoffs. | Hardware-backed signing where possible, recovery quorum, explicit revocation, and clear export semantics. |
| Device-bound key | Device key signs scoped consent receipts. | Device compromise, stale backups, and revoked consent resurrected during restore. | Secure enclave/keychain binding, device attestation, replay windows, and rotation on restore. |
| Broker-managed key | Private-compute or personal-cloud broker signs or countersigns consent. | Confused-deputy flows and provider custody takeover. | Per-scenario audience binding, purpose binding, scoped broker keys, append-only audit, and user-controlled revocation. |

## What The Repo Now Tests

The local custody attack probes check:

- replayed receipts after expiry;
- stale retired keys attempting new signing;
- confused-deputy purpose mismatch;
- cross-scenario receipt reuse;
- active-key freshness after rotation.

These probes are necessary but not sufficient. They test semantics. They do not prove secure storage, user identity, legal consent, non-repudiation, compromise response, or hardware isolation.

## What Would Be Required For A Production Claim

A production personal-agent custody design would need:

- real key generation and storage outside the public repo;
- user-visible signing ceremonies for boundary-crossing consent;
- key rotation and revocation that survive device loss and backup restore;
- replay protection and receipt freshness windows;
- broker audience binding so one service cannot reuse consent granted to another;
- independent security review of storage, recovery, and audit logs.

Until that exists, PAISL should say: "the benchmark tests custody semantics with fixture keys." It should not say: "the benchmark implements production custody."
