using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence.Common;
using MyPoultryManager.Api.Persistence.Entities;
using MyPoultryManager.Api.Services;

namespace MyPoultryManager.Api.Persistence;

public class AppDbContext : DbContext
{
    private readonly ITenantContext _tenantContext;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Farm> Farms => Set<Farm>();
    public DbSet<House> Houses => Set<House>();
    public DbSet<Flock> Flocks => Set<Flock>();
    public DbSet<DailyRecord> DailyRecords => Set<DailyRecord>();
    public DbSet<FeedItem> FeedItems => Set<FeedItem>();
    public DbSet<FeedStockMovement> FeedStockMovements => Set<FeedStockMovement>();
    public DbSet<HealthLog> HealthLogs => Set<HealthLog>();
    public DbSet<VaccinationSchedule> VaccinationSchedules => Set<VaccinationSchedule>();
    public DbSet<WeightSample> WeightSamples => Set<WeightSample>();
    public DbSet<HarvestRecord> HarvestRecords => Set<HarvestRecord>();
    public DbSet<FinancialTransaction> FinancialTransactions => Set<FinancialTransaction>();

    // ── Livestock Core ────────────────────────────────────────────────────────
    public DbSet<Species> Species => Set<Species>();
    public DbSet<Breed> Breeds => Set<Breed>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<AnimalGroup> AnimalGroups => Set<AnimalGroup>();
    public DbSet<Animal> Animals => Set<Animal>();
    public DbSet<HealthEvent> HealthEvents => Set<HealthEvent>();
    public DbSet<WeightRecord> WeightRecords => Set<WeightRecord>();
    public DbSet<MovementEvent> MovementEvents => Set<MovementEvent>();
    public DbSet<FeedEvent> FeedEvents => Set<FeedEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType)
                    .HasQueryFilter(GetTenantFilter(entityType.ClrType));
            }
        }

        modelBuilder.Entity<Tenant>()
            .HasIndex(t => t.Name)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.TenantId, u.Email })
            .IsUnique();

        modelBuilder.Entity<User>()
            .Property(u => u.Email)
            .HasMaxLength(255);

        modelBuilder.Entity<User>()
            .Property(u => u.FullName)
            .HasMaxLength(200);

        modelBuilder.Entity<User>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_Users_Role",
                    "\"Role\" IN ('owner','farm_manager','supervisor','worker','vet','accountant')");
            });

        modelBuilder.Entity<RefreshToken>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(r => r.Token)
            .IsUnique();

        modelBuilder.Entity<Farm>()
            .HasIndex(f => new { f.TenantId, f.Name })
            .IsUnique();

        modelBuilder.Entity<House>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(h => h.FarmId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<House>()
            .HasIndex(h => new { h.TenantId, h.FarmId, h.Name })
            .IsUnique();

        modelBuilder.Entity<House>()
            .Property(h => h.Name)
            .HasMaxLength(150);

        modelBuilder.Entity<House>()
            .Property(h => h.Notes)
            .HasMaxLength(500);

        modelBuilder.Entity<House>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_Houses_HouseType", "\"HouseType\" IN ('layer','broiler','grower')");
            });

        modelBuilder.Entity<Flock>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(f => f.FarmId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Flock>()
            .HasOne<House>()
            .WithMany()
            .HasForeignKey(f => f.HouseId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Flock>()
            .HasIndex(f => new { f.TenantId, f.BatchCode })
            .IsUnique();

        modelBuilder.Entity<Flock>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_Flocks_BirdType", "\"BirdType\" IN ('layer','broiler')");
                t.HasCheckConstraint("CK_Flocks_Status", "\"Status\" IN ('active','closed')");
            });

        modelBuilder.Entity<DailyRecord>()
            .HasOne<Flock>()
            .WithMany()
            .HasForeignKey(d => d.FlockId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DailyRecord>()
            .HasIndex(d => new { d.TenantId, d.FlockId, d.RecordDate })
            .IsUnique();

        modelBuilder.Entity<FeedItem>()
            .HasIndex(f => new { f.TenantId, f.Name })
            .IsUnique();

        modelBuilder.Entity<FeedItem>()
            .Property(f => f.Name)
            .HasMaxLength(150);

        modelBuilder.Entity<FeedItem>()
            .Property(f => f.Notes)
            .HasMaxLength(500);

        modelBuilder.Entity<FeedItem>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_FeedItems_Unit", "\"Unit\" IN ('kg','bag','ton')");
            });

        modelBuilder.Entity<FeedStockMovement>()
            .HasOne<FeedItem>()
            .WithMany()
            .HasForeignKey(m => m.FeedItemId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FeedStockMovement>()
            .HasOne<Flock>()
            .WithMany()
            .HasForeignKey(m => m.FlockId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FeedStockMovement>()
            .Property(m => m.Notes)
            .HasMaxLength(500);

        modelBuilder.Entity<FeedStockMovement>()
            .Property(m => m.Reference)
            .HasMaxLength(100);

        modelBuilder.Entity<FeedStockMovement>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_FeedStockMovements_MovementType",
                    "\"MovementType\" IN ('purchase','usage','adjustment')");
            });

        modelBuilder.Entity<HealthLog>()
            .HasOne<Flock>()
            .WithMany()
            .HasForeignKey(h => h.FlockId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<HealthLog>()
            .Property(h => h.Medication)
            .HasMaxLength(200);

        modelBuilder.Entity<HealthLog>()
            .Property(h => h.VetName)
            .HasMaxLength(200);

        modelBuilder.Entity<VaccinationSchedule>()
            .HasOne<Flock>()
            .WithMany()
            .HasForeignKey(v => v.FlockId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<VaccinationSchedule>()
            .Property(v => v.VaccineName)
            .HasMaxLength(200);

        modelBuilder.Entity<WeightSample>()
            .HasOne<Flock>()
            .WithMany()
            .HasForeignKey(w => w.FlockId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<HarvestRecord>()
            .HasOne<Flock>()
            .WithMany()
            .HasForeignKey(h => h.FlockId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<HarvestRecord>()
            .Property(h => h.BuyerName)
            .HasMaxLength(200);

        modelBuilder.Entity<FinancialTransaction>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(t => t.FarmId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FinancialTransaction>()
            .HasOne<Flock>()
            .WithMany()
            .HasForeignKey(t => t.FlockId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FinancialTransaction>()
            .Property(t => t.Reference)
            .HasMaxLength(100);

        modelBuilder.Entity<FinancialTransaction>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_FinancialTransactions_Type",
                    "\"Type\" IN ('income','expense')");
                t.HasCheckConstraint("CK_FinancialTransactions_Category",
                    "\"Category\" IN ('feed','medication','utilities','egg_sale','bird_sale','labor','other')");
            });

        // ── Livestock Core ────────────────────────────────────────────────────

        modelBuilder.Entity<Species>()
            .Property(s => s.Name).HasMaxLength(80);
        modelBuilder.Entity<Species>()
            .Property(s => s.Code).HasMaxLength(30);
        modelBuilder.Entity<Species>()
            .HasIndex(s => new { s.TenantId, s.Code }).IsUnique();
        modelBuilder.Entity<Species>()
            .HasIndex(s => new { s.TenantId, s.Name }).IsUnique();

        modelBuilder.Entity<Breed>()
            .Property(b => b.Name).HasMaxLength(100);
        modelBuilder.Entity<Breed>()
            .HasIndex(b => new { b.TenantId, b.SpeciesId, b.Name }).IsUnique();
        modelBuilder.Entity<Breed>()
            .HasOne<Species>()
            .WithMany()
            .HasForeignKey(b => b.SpeciesId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Location>()
            .Property(l => l.Name).HasMaxLength(150);
        modelBuilder.Entity<Location>()
            .Property(l => l.LocationType).HasMaxLength(20);
        modelBuilder.Entity<Location>()
            .Property(l => l.Notes).HasMaxLength(500);
        modelBuilder.Entity<Location>()
            .HasIndex(l => new { l.TenantId, l.FarmId, l.Name }).IsUnique();
        modelBuilder.Entity<Location>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(l => l.FarmId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Location>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_Locations_LocationType",
                    "\"LocationType\" IN ('Barn','Paddock','Pen','House','Shed','Other')");
            });

        modelBuilder.Entity<AnimalGroup>()
            .Property(g => g.GroupCode).HasMaxLength(50);
        modelBuilder.Entity<AnimalGroup>()
            .Property(g => g.Name).HasMaxLength(150);
        modelBuilder.Entity<AnimalGroup>()
            .Property(g => g.Status).HasMaxLength(10);
        modelBuilder.Entity<AnimalGroup>()
            .HasIndex(g => new { g.TenantId, g.FarmId, g.GroupCode }).IsUnique();
        modelBuilder.Entity<AnimalGroup>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(g => g.FarmId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AnimalGroup>()
            .HasOne<Species>()
            .WithMany()
            .HasForeignKey(g => g.SpeciesId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AnimalGroup>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_AnimalGroups_Status",
                    "\"Status\" IN ('Active','Closed')");
            });

        modelBuilder.Entity<Animal>()
            .Property(a => a.TagNumber).HasMaxLength(60);
        modelBuilder.Entity<Animal>()
            .Property(a => a.Name).HasMaxLength(120);
        modelBuilder.Entity<Animal>()
            .Property(a => a.Sex).HasMaxLength(10);
        modelBuilder.Entity<Animal>()
            .Property(a => a.Status).HasMaxLength(10);
        modelBuilder.Entity<Animal>()
            .Property(a => a.Notes).HasMaxLength(500);
        modelBuilder.Entity<Animal>()
            .HasIndex(a => new { a.TenantId, a.TagNumber }).IsUnique();
        modelBuilder.Entity<Animal>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(a => a.FarmId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Animal>()
            .HasOne<Species>()
            .WithMany()
            .HasForeignKey(a => a.SpeciesId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Animal>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_Animals_Sex",
                    "\"Sex\" IN ('Male','Female','Unknown')");
                t.HasCheckConstraint("CK_Animals_Status",
                    "\"Status\" IN ('Alive','Sold','Dead','Culled')");
            });

        modelBuilder.Entity<HealthEvent>()
            .Property(h => h.EventType).HasMaxLength(20);
        modelBuilder.Entity<HealthEvent>()
            .Property(h => h.Diagnosis).HasMaxLength(500);
        modelBuilder.Entity<HealthEvent>()
            .Property(h => h.Medication).HasMaxLength(200);
        modelBuilder.Entity<HealthEvent>()
            .Property(h => h.Dose).HasMaxLength(100);
        modelBuilder.Entity<HealthEvent>()
            .Property(h => h.Notes).HasMaxLength(1000);
        modelBuilder.Entity<HealthEvent>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(h => h.FarmId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<HealthEvent>()
            .HasOne<Species>()
            .WithMany()
            .HasForeignKey(h => h.SpeciesId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<HealthEvent>()
            .ToTable(t =>
            {
                t.HasCheckConstraint("CK_HealthEvents_EventType",
                    "\"EventType\" IN ('Vaccination','Treatment','Illness','Checkup','Deworming','Other')");
            });

        modelBuilder.Entity<WeightRecord>()
            .Property(w => w.Notes).HasMaxLength(500);
        modelBuilder.Entity<WeightRecord>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(w => w.FarmId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<WeightRecord>()
            .HasOne<Species>()
            .WithMany()
            .HasForeignKey(w => w.SpeciesId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MovementEvent>()
            .Property(m => m.Reason).HasMaxLength(200);
        modelBuilder.Entity<MovementEvent>()
            .Property(m => m.Notes).HasMaxLength(500);
        modelBuilder.Entity<MovementEvent>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(m => m.FarmId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<MovementEvent>()
            .HasOne<Species>()
            .WithMany()
            .HasForeignKey(m => m.SpeciesId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FeedEvent>()
            .Property(f => f.FeedName).HasMaxLength(150);
        modelBuilder.Entity<FeedEvent>()
            .Property(f => f.Notes).HasMaxLength(500);
        modelBuilder.Entity<FeedEvent>()
            .HasOne<Farm>()
            .WithMany()
            .HasForeignKey(f => f.FarmId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<FeedEvent>()
            .HasOne<Species>()
            .WithMany()
            .HasForeignKey(f => f.SpeciesId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var userId = _tenantContext.UserId;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.CreatedBy = userId;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                entry.Entity.UpdatedBy = userId;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    // Only filter soft-deletes globally. Tenant isolation is handled explicitly
    // in each controller via Where(e.TenantId == tenantId). Capturing TenantId
    // here would bake in the null value from startup time, returning 0 rows.
    private static LambdaExpression GetTenantFilter(Type type)
    {
        var param = Expression.Parameter(type, "e");
        var isDeletedProp = Expression.Property(param, "IsDeleted");
        var body = Expression.Equal(isDeletedProp, Expression.Constant(false));
        return Expression.Lambda(body, param);
    }
}
