using FleetDesk.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FleetDesk.Api.Data;

public class FleetDeskDbContext : DbContext
{
    public FleetDeskDbContext(DbContextOptions<FleetDeskDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Name).HasMaxLength(100);
            e.Property(u => u.Email).HasMaxLength(200);
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<Vehicle>(e =>
        {
            e.HasIndex(v => v.Rego).IsUnique();
            e.Property(v => v.Rego).HasMaxLength(20);
            e.Property(v => v.Make).HasMaxLength(50);
            e.Property(v => v.Model).HasMaxLength(50);
            e.Property(v => v.Location).HasMaxLength(100);
            e.Property(v => v.Status).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<Booking>(e =>
        {
            e.Property(b => b.Purpose).HasMaxLength(200);
            e.Property(b => b.Status).HasConversion<string>().HasMaxLength(20);
            e.HasOne(b => b.Vehicle)
                .WithMany(v => v.Bookings)
                .HasForeignKey(b => b.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(b => b.User)
                .WithMany(u => u.Bookings)
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Service>(e =>
        {
            e.Property(s => s.Type).HasMaxLength(50);
            e.Property(s => s.Notes).HasMaxLength(500);
            e.Property(s => s.Cost).HasPrecision(10, 2);
            e.HasOne(s => s.Vehicle)
                .WithMany(v => v.Services)
                .HasForeignKey(s => s.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.Property(a => a.Action).HasMaxLength(50);
            e.Property(a => a.Entity).HasMaxLength(50);
        });
    }
}
