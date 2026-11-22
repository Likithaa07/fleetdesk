# FleetDesk Requirements

A web app where fleet managers track company vehicles and drivers book cars, with alerts for services, rego and lease ends.

## Roles

| Role | Can do |
|---|---|
| Manager | Add/edit vehicles, see all bookings, log services, see alerts |
| Driver | Browse available cars, book, see and cancel own bookings |

## Business rules

- **BR1:** A car can't be booked for overlapping dates.
- **BR2:** Can't book a car that's in service or whose rego has expired.
- **BR3:** End date must be after start date, and no bookings in the past.
- **BR4:** Logging a service sets NextServiceDue to the service date plus 6 months.
- **BR5:** Alerts for service overdue, rego expiring within 30 days, and lease ending within 60 days.
- **BR6:** Drivers only see their own bookings.

## User stories

See the GitHub issues US1 to US10 (issues #2 to #11) and the FleetDesk Board.
