using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/livestock/reports")]
[Authorize]
public class LivestockReportsController : ControllerBase
{
    private readonly AppDbContext _db;

    public LivestockReportsController(AppDbContext db) => _db = db;

    // GET /api/v1/livestock/reports/herd-summary?farmId=
    [HttpGet("herd-summary")]
    public async Task<IActionResult> HerdSummary([FromQuery] Guid farmId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var animals = await _db.Animals
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.FarmId == farmId && !a.IsDeleted)
            .Select(a => new { a.SpeciesId, a.Status })
            .ToListAsync();

        var speciesIds = animals.Select(a => a.SpeciesId).Distinct().ToList();
        var speciesNames = await _db.Species
            .AsNoTracking()
            .Where(s => speciesIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name);

        var bySpecies = animals
            .GroupBy(a => a.SpeciesId)
            .Select(g => new
            {
                speciesId   = g.Key,
                speciesName = speciesNames.GetValueOrDefault(g.Key, "Unknown"),
                alive   = g.Count(a => a.Status == "Alive"),
                sold    = g.Count(a => a.Status == "Sold"),
                dead    = g.Count(a => a.Status == "Dead"),
                culled  = g.Count(a => a.Status == "Culled"),
                total   = g.Count(),
            })
            .OrderBy(x => x.speciesName)
            .ToList();

        return Ok(new { bySpecies });
    }

    // GET /api/v1/livestock/reports/milk-summary?farmId=&days=30
    [HttpGet("milk-summary")]
    public async Task<IActionResult> MilkSummary([FromQuery] Guid farmId, [FromQuery] int days = 30)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-days));

        var records = await _db.MilkRecords
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.FarmId == farmId && !m.IsDeleted
                     && m.RecordDate >= cutoff)
            .Select(m => new { m.SpeciesId, m.RecordDate, m.QuantityLitres })
            .ToListAsync();

        var speciesIds = records.Select(m => m.SpeciesId).Distinct().ToList();
        var speciesNames = await _db.Species
            .AsNoTracking()
            .Where(s => speciesIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name);

        var totalLitres = records.Sum(m => m.QuantityLitres);
        var avgDailyLitres = days > 0 ? Math.Round(totalLitres / days, 2) : 0;

        var bySpecies = records
            .GroupBy(m => m.SpeciesId)
            .Select(g => new
            {
                speciesId   = g.Key,
                speciesName = speciesNames.GetValueOrDefault(g.Key, "Unknown"),
                totalLitres = g.Sum(m => m.QuantityLitres),
            })
            .OrderByDescending(x => x.totalLitres)
            .ToList();

        var recent = records
            .GroupBy(m => m.RecordDate)
            .Select(g => new { date = g.Key.ToString("yyyy-MM-dd"), litres = g.Sum(m => m.QuantityLitres) })
            .OrderBy(x => x.date)
            .ToList();

        return Ok(new { totalLitres, avgDailyLitres, bySpecies, recent });
    }

    // GET /api/v1/livestock/reports/breeding-summary?farmId=
    [HttpGet("breeding-summary")]
    public async Task<IActionResult> BreedingSummary([FromQuery] Guid farmId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var pregnancies = await _db.PregnancyRecords
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.FarmId == farmId && !p.IsDeleted)
            .Select(p => new { p.Status, p.ExpectedDueDate, p.DamId })
            .ToListAsync();

        var dueSoonCutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(21));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var dueSoon = pregnancies
            .Where(p => p.Status != "GaveBirth" && p.Status != "Aborted" && p.Status != "NotPregnant"
                     && p.ExpectedDueDate >= today && p.ExpectedDueDate <= dueSoonCutoff)
            .Select(p => new
            {
                damId           = p.DamId,
                expectedDueDate = p.ExpectedDueDate.ToString("yyyy-MM-dd"),
                status          = p.Status,
            })
            .OrderBy(x => x.expectedDueDate)
            .ToList();

        var summary = new
        {
            suspected   = pregnancies.Count(p => p.Status == "Suspected"),
            confirmed   = pregnancies.Count(p => p.Status == "Confirmed"),
            gaveBirth   = pregnancies.Count(p => p.Status == "GaveBirth"),
            aborted     = pregnancies.Count(p => p.Status == "Aborted"),
            notPregnant = pregnancies.Count(p => p.Status == "NotPregnant"),
        };

        return Ok(new { pregnancies = summary, dueSoon });
    }

    // GET /api/v1/livestock/reports/transaction-summary?farmId=
    [HttpGet("transaction-summary")]
    public async Task<IActionResult> TransactionSummary([FromQuery] Guid farmId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var txs = await _db.AnimalTransactions
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.FarmId == farmId && !t.IsDeleted)
            .Select(t => new { t.TransactionType, t.HeadCount, t.TotalPrice })
            .ToListAsync();

        var purchases = txs.Where(t => t.TransactionType == "Purchase").ToList();
        var sales     = txs.Where(t => t.TransactionType == "Sale").ToList();

        return Ok(new
        {
            totalPurchased = purchases.Sum(t => t.HeadCount),
            totalSold      = sales.Sum(t => t.HeadCount),
            totalSpent     = purchases.Sum(t => t.TotalPrice),
            totalEarned    = sales.Sum(t => t.TotalPrice),
            netFlow        = sales.Sum(t => t.TotalPrice) - purchases.Sum(t => t.TotalPrice),
        });
    }

    private bool TryGetTenantId(out Guid tenantId, out ActionResult? errorResult)
    {
        tenantId = Guid.Empty;
        errorResult = null;
        var claim = User.FindFirst("tenantId")?.Value;
        if (Guid.TryParse(claim, out tenantId)) return true;
        errorResult = Unauthorized("Tenant claim missing from token.");
        return false;
    }
}
