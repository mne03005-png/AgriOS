# Security Policy

## Supported versions

OpenAgriOS is currently an alpha project. Security fixes are applied to the latest release and the `main` branch.

| Version | Supported |
| --- | --- |
| Latest pre-release | Yes |
| Older pre-releases | No |

## Reporting a vulnerability

Please do not report security vulnerabilities in a public issue, discussion, or pull request.

Email the repository maintainer at `mne03005@gmail.com` with the subject `OpenAgriOS security report`. Include:

- the affected component and version or commit;
- reproduction steps or a minimal proof of concept;
- the potential impact;
- whether pumps, valves, gateways, sensors, or other physical equipment could be affected;
- any suggested mitigation;
- whether the issue is already public or under active exploitation.

Do not include production credentials, precise farm locations, personal data, or sensitive device inventories in the initial email. Maintainers will arrange a safer transfer method if additional artifacts are needed.

Maintainers will acknowledge a report within 7 days, provide an initial assessment when enough information is available, and coordinate disclosure and remediation with the reporter. Please allow a reasonable remediation period before public disclosure.

## Security scope

Reports involving authentication, tenant isolation, MQTT authorization, unsafe device commands, secret exposure, telemetry integrity, upload handling, or dependency vulnerabilities are in scope.

The alpha Docker Compose stack is designed for local evaluation. Its anonymous MQTT access and public demo API are documented limitations and must not be exposed directly to the public internet. Reports that merely restate those documented local-demo limitations may be closed, but bypasses affecting a secured deployment remain in scope.

## Safe-harbor intent

Good-faith research that avoids privacy violations, data destruction, service disruption, and access beyond what is necessary to demonstrate the issue will be treated as authorized security research. Do not test against farms, devices, or accounts you do not own or have explicit permission to assess. Never issue commands that could energize pumps, open valves, interrupt irrigation, damage crops, or create electrical, hydraulic, or personnel hazards; use mock or dry-run modes for reproduction.
