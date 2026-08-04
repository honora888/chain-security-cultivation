# Pinned Moss Packages

These packages are vendored for the Chain Security Cultivation
Guardian Agent integration.

Source repository:
https://github.com/honora888/moss

Source branch:
feat/guardian-moss-integration

Source commit:
07b673844f8ca14e992c6dfe305c83018114a791

Included prerequisite:
3bbb4c1 feat(core): allow explicit runtime chain ID

Packages:
- @themoss/core 0.1.0
- @themoss/simulator 0.1.0
- @themoss/protocol-guardian 0.1.0

Build and packaging:
- pnpm build
- pnpm pack

Integrity hashes are recorded in SHA256SUMS.txt.

These packages:
- support Monad Testnet chain ID 10143;
- include the GuardianQuest protocol adapter;
- construct and simulate unsigned transactions;
- do not sign or broadcast transactions;
- contain no RPC URL, private key, seed phrase, or wallet credentials.
