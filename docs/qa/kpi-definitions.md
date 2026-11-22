# FleetDesk KPI Definitions

These KPIs measure the accuracy and quality of FleetDesk's data and processes. They feed the weekly report and the KPI dashboard.

| KPI | Definition | Formula | Target | Source |
|---|---|---|---|---|
| Booking error rate | Share of sampled bookings with a data or rule error (overlap, past date, in-service or expired-rego vehicle) | Bookings with errors / bookings sampled x 100 | Below 2% | Data audit script |
| Services logged on time | Share of services recorded within 2 days of the service date | Services logged on time / total services x 100 | 95% or higher | Services table |
| Next-service accuracy | Share of services where NextServiceDue equals service date plus 6 months | Correct dates / total services x 100 | 100% | Data audit script |
| Overdue alert coverage | Share of overdue vehicles that appear in the alerts list | Overdue vehicles alerted / overdue vehicles x 100 | 100% | Alerts API vs Vehicles table |
| Audit pass rate | Share of randomly sampled records that pass every check | Records passed / records sampled x 100 | 98% or higher | Sampling log |
| Defect escape rate | Defects found after a feature was marked Done | Defects found after Done / total defects x 100 | Below 10% | GitHub issues |
| Findings closed on time | Audit findings closed by their due date | Closed on time / total findings x 100 | 90% or higher | Findings log |

## Reporting
- **Frequency:** weekly
- **Report:** one page for the QA Manager, covering each KPI, the trend, the top three findings and the actions taken
- **Evidence:** audit outputs are kept in `docs/qa/evidence`
