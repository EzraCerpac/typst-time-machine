# Security Policy

## Supported versions

Only the latest released minor series receives security fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use
[GitHub private vulnerability reporting](https://github.com/EzraCerpac/typst-time-machine/security/advisories/new).

Include the affected version and platform, reproduction steps, expected impact,
whether repository content must be attacker-controlled, and useful logs with
secrets and personal paths removed. I aim to acknowledge reports within seven
days and will coordinate disclosure and credit with the reporter.

## Scope

Useful reports include:

- escaping the repository or materialized-snapshot boundary;
- arbitrary local file disclosure through the viewer, cache, or SVG API;
- command or argument injection from repository-controlled data;
- mutation of Git, JJ, or the working copy;
- bypass of the loopback capability URL or Origin protections;
- cross-repository or cross-revision cache confusion.

Upstream Git, Jujutsu, Typst, or browser vulnerabilities are out of scope unless
Typst Time Machine introduces or materially worsens the exposure. Running an
untrusted binary supplied through `--typst` is also outside the security
boundary.
