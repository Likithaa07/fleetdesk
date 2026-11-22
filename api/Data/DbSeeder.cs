using FleetDesk.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Data;

public static class DbSeeder
{
    // Demo password for fake test accounts only. Never reuse a real password.
    public const string DemoPassword = "Password123!";

    // Drops the database, recreates it from migrations and reseeds it.
    public static async Task ResetAsync(FleetDeskDbContext db)
    {
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        await SeedAsync(db);
    }

    public static async Task SeedAsync(FleetDeskDbContext db)
    {
        if (await db.Users.AnyAsync()) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var hash = BCrypt.Net.BCrypt.HashPassword(DemoPassword);

        var maria = new User { Name = "Maria Manager", Email = "manager@fleetdesk.test", PasswordHash = hash, Role = UserRole.Manager };
        var dan = new User { Name = "Dan Driver", Email = "driver1@fleetdesk.test", PasswordHash = hash, Role = UserRole.Driver };
        var priya = new User { Name = "Priya Driver", Email = "driver2@fleetdesk.test", PasswordHash = hash, Role = UserRole.Driver };
        db.Users.AddRange(maria, dan, priya);

        // v1 healthy, v2 in service, v3 expired rego, v4 service overdue,
        // v5 rego expiring soon, v6 lease ending soon
        var v1 = new Vehicle { Rego = "ABC123", Make = "Toyota", Model = "Camry", Year = 2022, Location = "Sydney", Status = VehicleStatus.Available, OdometerKm = 24000, RegoExpiry = today.AddDays(200), LeaseEnd = today.AddDays(400), NextServiceDue = today.AddMonths(3) };
        var v2 = new Vehicle { Rego = "DEF456", Make = "Mazda", Model = "CX-5", Year = 2021, Location = "Melbourne", Status = VehicleStatus.InService, OdometerKm = 41000, RegoExpiry = today.AddDays(150), LeaseEnd = today.AddDays(300), NextServiceDue = today.AddDays(30) };
        var v3 = new Vehicle { Rego = "GHI789", Make = "Hyundai", Model = "i30", Year = 2020, Location = "Sydney", Status = VehicleStatus.Available, OdometerKm = 58000, RegoExpiry = today.AddDays(-10), LeaseEnd = today.AddDays(200), NextServiceDue = today.AddDays(60) };
        var v4 = new Vehicle { Rego = "JKL012", Make = "Ford", Model = "Ranger", Year = 2021, Location = "Brisbane", Status = VehicleStatus.Available, OdometerKm = 38000, RegoExpiry = today.AddDays(120), LeaseEnd = today.AddDays(250), NextServiceDue = today.AddDays(-15) };
        var v5 = new Vehicle { Rego = "MNO345", Make = "Kia", Model = "Cerato", Year = 2022, Location = "Sydney", Status = VehicleStatus.Available, OdometerKm = 19000, RegoExpiry = today.AddDays(20), LeaseEnd = today.AddDays(300), NextServiceDue = today.AddDays(100) };
        var v6 = new Vehicle { Rego = "PQR678", Make = "Subaru", Model = "Outback", Year = 2023, Location = "Melbourne", Status = VehicleStatus.Available, OdometerKm = 9000, RegoExpiry = today.AddDays(180), LeaseEnd = today.AddDays(45), NextServiceDue = today.AddDays(120) };
        db.Vehicles.AddRange(v1, v2, v3, v4, v5, v6);

        await db.SaveChangesAsync();

        db.Bookings.AddRange(
            new Booking { VehicleId = v1.Id, UserId = dan.Id, StartDate = today.AddDays(5), EndDate = today.AddDays(9), Purpose = "Client meeting in Newcastle", Status = BookingStatus.Active },
            new Booking { VehicleId = v1.Id, UserId = priya.Id, StartDate = today.AddDays(5), EndDate = today.AddDays(9), Purpose = "Site visit", Status = BookingStatus.Cancelled },
            new Booking { VehicleId = v6.Id, UserId = priya.Id, StartDate = today.AddDays(10), EndDate = today.AddDays(12), Purpose = "Training day", Status = BookingStatus.Active },
            new Booking { VehicleId = v4.Id, UserId = priya.Id, StartDate = today.AddDays(-20), EndDate = today.AddDays(-18), Purpose = "Delivery run", Status = BookingStatus.Active });

        db.Services.AddRange(
            new Service { VehicleId = v1.Id, Date = today.AddMonths(-3), OdometerKm = 21000, Type = "Logbook service", Cost = 420.00m, Notes = "Oil and filter" },
            new Service { VehicleId = v4.Id, Date = today.AddMonths(-6).AddDays(-15), OdometerKm = 34000, Type = "Logbook service", Cost = 380.00m, Notes = "Brake check" });

        await db.SaveChangesAsync();
    }
}
