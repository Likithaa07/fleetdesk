# FleetDesk Test Data Guide

Seed data is created by `api/Data/DbSeeder.cs`. Dates are relative to the day the data is seeded, so the alerts stay valid.

## Reset the database to a known state
```bash
dotnet run --project api -- --reset-db
```
This drops, recreates and reseeds the database. It only runs in Development. Run it before every manual or automated test run.

## Test accounts (fake data only)

| Name | Email | Role |
|---|---|---|
| Maria Manager | manager@fleetdesk.test | Manager |
| Dan Driver | driver1@fleetdesk.test | Driver |
| Priya Driver | driver2@fleetdesk.test | Driver |

All three accounts share the demo password in `DbSeeder.DemoPassword`. Never reuse a real password.

## Vehicles

| Rego | Vehicle | Location | Scenario it covers | Rules and alerts |
|---|---|---|---|---|
| ABC123 | Toyota Camry | Sydney | Healthy car, available to book | BR1 overlap tests |
| DEF456 | Mazda CX-5 | Melbourne | Car in service | BR2: cannot be booked |
| GHI789 | Hyundai i30 | Sydney | Rego expired 10 days ago | BR2: cannot be booked, rego alert |
| JKL012 | Ford Ranger | Brisbane | Service overdue by 15 days | BR5: service overdue alert |
| MNO345 | Kia Cerato | Sydney | Rego expires in 20 days | BR5: rego expiring within 30 days |
| PQR678 | Subaru Outback | Melbourne | Lease ends in 45 days | BR5: lease ending within 60 days |

## Bookings

| # | Vehicle | Driver | Dates (from today) | Status | Scenario it covers |
|---|---|---|---|---|---|
| 1 | ABC123 | Dan | +5 to +9 days | Active | BR1: a new booking for these dates must be rejected |
| 2 | ABC123 | Priya | +5 to +9 days | Cancelled | A cancelled booking must not block the dates |
| 3 | PQR678 | Priya | +10 to +12 days | Active | BR6: Dan must not see it |
| 4 | JKL012 | Priya | -20 to -18 days | Active | Past booking in history |

## Services

| Vehicle | Date | Scenario it covers |
|---|---|---|
| ABC123 | 3 months ago | BR4: next service due is service date plus 6 months |
| JKL012 | About 6.5 months ago | Next service is overdue |

## Totals after a reset
3 users, 6 vehicles, 4 bookings, 2 services.
