# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in BusinessOS, please report
it privately. **Do not open a public issue.**

- Email: **coe@techentrance.in** (subject line: `SECURITY`)
- Include: a description, steps to reproduce, affected endpoint(s)/component(s),
  and the impact you believe it has.
- Please give us a reasonable time to investigate and fix the issue before any
  public disclosure.

We aim to acknowledge reports within 3 business days.

## Supported versions

Only the currently deployed `main` branch is supported. Fixes are rolled forward;
there are no long-term support branches.

## Handling process

1. Acknowledge the report and open a private tracking issue.
2. Reproduce and assess severity (CVSS-style: impact × exploitability).
3. Develop and test a fix on a private branch.
4. Deploy the fix; rotate any credentials that may have been exposed.
5. Review audit logs for signs of exploitation; notify affected organizations if
   customer data was accessed, as required by applicable law.
6. Post-incident review; add a regression test.

## Scope notes for testers

- Test only against your own organization/tenant and your own accounts.
- Do not run automated scanners that could degrade service for other tenants.
- Do not attempt denial-of-service, spam, or social-engineering attacks.
- Cross-tenant data access, authentication/authorization bypass, RCE, SSRF,
  stored XSS, and IDOR/BOLA findings are all in scope and valued.
