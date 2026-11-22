# FleetDesk Master Test Plan

## 1. Objective
Show that FleetDesk meets its requirements (BR1 to BR6 and user stories US1 to US10) and protect against defects before release.

## 2. Scope
**In scope:** login and roles, vehicles, bookings, services, alerts, API, database, UI, integrations (rego-check and notification services).
**Out of scope:** real payment or real GPS tracking, and any real customer data.

## 3. Test phases

| Phase | Purpose | Tools |
|---|---|---|
| Functional | Each business rule behaves correctly | Manual test cases, xUnit |
| Integration | React, API, SQL Server and external services work together | xUnit with WebApplicationFactory |
| Regression and smoke | Nothing breaks after a change | Playwright |
| Performance and load | Response times hold under load | k6 or JMeter |
| UAT | Real users can complete their tasks | UAT scripts |

## 4. Environments
- **Local:** SQL Server in Docker, API and web on localhost
- **Staging and production:** Azure (set up later)

## 5. Test data
Seed data covers: an available car, a car in service, a car with expired rego, overlapping bookings, a Manager and a Driver. A reset script restores the database before each test run.

## 6. Entry criteria
- Requirements and acceptance criteria are written
- The feature is merged to a test branch and builds
- Test data is ready

## 7. Exit criteria
- All planned test cases are run
- No open critical or high severity defects
- Smoke and regression suites pass in CI
- UAT is signed off

## 8. Defect handling
Defects are raised as GitHub issues with steps, expected and actual result, severity, priority and screenshots. Defects are triaged, fixed, re-tested and closed with evidence. A blocker is escalated straight away so testing keeps moving.

**Severity:** Critical (system unusable), High (a rule fails), Medium (workaround exists), Low (cosmetic).

## 9. Roles
- **Tester:** designs and runs tests, raises defects
- **Developer:** fixes defects
- **UAT participants:** friends acting as a Manager and a Driver

## 10. Risks

| Risk | Mitigation |
|---|---|
| External service is down | Mock the service and test failure cases |
| Test data gets out of date | Reset script before each run |
| Not enough time | Prioritise smoke tests and the booking rules first |

## 11. Deliverables
Test cases, traceability matrix, automated test suites, defect log, performance report, UAT plan and sign-off, test summary reports.
