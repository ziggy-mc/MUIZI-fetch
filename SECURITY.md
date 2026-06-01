# Security Policy

This overviews how to use MUIZI fetch correctly.

## Supported Versions

Because this repository is public and actively developed, security updates are only provided for the latest version available on the `main` branch.

| Version               | Supported          |
| --------------------- | ------------------ |
| `main`                | :white_check_mark: |
| Older commits / forks | :x:                |

Users are strongly encouraged to stay up to date with the latest commits and releases.

---

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

### Do Not

* Open a public issue describing the vulnerability
* Publicly disclose exploit methods before a fix is released
* Abuse or exploit the vulnerability beyond what is necessary to demonstrate the issue

### How to Report

Please report vulnerabilities privately through GitHub Security Advisories or by contacting the repository maintainer directly through GitHub.

When submitting a report, include:

* A description of the vulnerability
* Steps to reproduce the issue
* Potential impact
* Any relevant logs, screenshots, or proof-of-concept examples
* Suggested mitigations (optional)

---

## Response Timeline

The maintainer will attempt to:

* Acknowledge reports within 72 hours
* Investigate and validate the report
* Release a patch or mitigation if necessary
* Keep the reporter informed throughout the process when possible

Not all reports may qualify as valid security vulnerabilities.

---

## Public Repository Notice

This repository is publicly accessible. While reasonable effort is made to improve security, no guarantees are provided regarding:

* Complete protection against vulnerabilities
* Availability or uptime
* Compatibility with third-party services
* Security of self-hosted deployments

Users who deploy or fork this project are responsible for securing their own environments, infrastructure, API keys, webhook URLs, and configuration files.

---

## Recommended Security Practices

If you are self-hosting or modifying this project:

* Never commit `.env` files or secrets
* Use HTTPS in production
* Keep dependencies updated
* Review all pull requests before merging
* Restrict access to server logs and configuration files
* Rotate credentials immediately if exposed

---

## Disclosure Policy

Security vulnerabilities may be publicly disclosed after:

* A fix has been released, or
* The maintainer determines the issue no longer presents significant risk

The maintainer reserves the right to reject reports that are spam, duplicates, out of scope, or require unrealistic attack conditions.
