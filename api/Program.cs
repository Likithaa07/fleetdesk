using FleetDesk.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<FleetDeskDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// Test data reset: dotnet run --project api -- --reset-db
// Drops, recreates and reseeds the database. Development only.
if (args.Contains("--reset-db"))
{
    if (!app.Environment.IsDevelopment())
    {
        Console.WriteLine("Refusing to reset the database outside Development.");
        return;
    }

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<FleetDeskDbContext>();
    await DbSeeder.ResetAsync(db);
    Console.WriteLine("Database reset and seeded.");
    return;
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
