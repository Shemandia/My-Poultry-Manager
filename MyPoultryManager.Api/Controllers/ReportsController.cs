using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReportsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/reports/dashboard
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        if (!TryGetTenantId(out _, out var error)) return error!;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Active flocks
        var activeFlocks = await _db.Flocks
            .AsNoTracking()
            .Where(f => f.Status == "active")
            .Select(f => new { f.Id, f.InitialCount })
            .ToListAsync();

        var activeFlocksCount = activeFlocks.Count;
        var activeFlocksIds = activeFlocks.Select(f => f.Id).ToList();

        // Total mortality per active flock to compute current bird count
        var mortalityByFlock = await _db.DailyRecords
            .AsNoTracking()
            .Where(r => activeFlocksIds.Contains(r.FlockId))
            .GroupBy(r => r.FlockId)
            .Select(g => new { FlockId = g.Key, Total = g.Sum(r => r.Mortality) })
            .ToListAsync();

        var totalActiveBirds = activeFlocks.Sum(f =>
        {
            var mort = mortalityByFlock.FirstOrDefault(m => m.FlockId == f.Id)?.Total ?? 0;
            return f.InitialCount - mort;
        });

        // Today's production across all flocks
        var todayRecords = await _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.RecordDate == today)
            .ToListAsync();

        // Low-stock feed items
        var lowStockItems = await _db.FeedItems
            .AsNoTracking()
            .Where(f => f.LowStockThresholdKg.HasValue && f.CurrentStockKg <= f.LowStockThresholdKg.Value)
            .Select(f => new
            {
                f.Id,
                f.Name,
                f.Unit,
                f.CurrentStockKg,
                f.LowStockThresholdKg
            })
            .ToListAsync();

        // Farm count
        var farmCount = await _db.Farms.AsNoTracking().CountAsync();

        return Ok(new
        {
            farmCount,
            activeFlocksCount,
            totalActiveBirds,
            today = new
            {
                date = today,
                eggsTotal = todayRecords.Sum(r => r.EggsTotal),
                eggsBroken = todayRecords.Sum(r => r.EggsBroken),
                eggsSold = todayRecords.Sum(r => r.EggsSold),
                mortality = todayRecords.Sum(r => r.Mortality),
                feedConsumedKg = todayRecords.Sum(r => r.FeedConsumedKg),
                recordedFlocks = todayRecords.Count
            },
            lowStockAlerts = lowStockItems
        });
    }

    // GET /api/v1/reports/flocks/{id}/performance?dateFrom=&dateTo=
    [HttpGet("flocks/{id:guid}/performance")]
    public async Task<IActionResult> FlockPerformance(
        Guid id,
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out _, out var error)) return error!;

        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
            return BadRequest("dateFrom must be on or before dateTo.");

        var flock = await _db.Flocks
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id);

        if (flock is null) return NotFound();

        // All-time mortality (for current bird count)
        var allTimeMortality = await _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.FlockId == id)
            .SumAsync(r => r.Mortality);

        var currentBirdCount = flock.InitialCount - allTimeMortality;

        // Records in requested date range
        var query = _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.FlockId == id);

        if (dateFrom.HasValue) query = query.Where(r => r.RecordDate >= dateFrom.Value);
        if (dateTo.HasValue)   query = query.Where(r => r.RecordDate <= dateTo.Value);

        var records = await query
            .OrderBy(r => r.RecordDate)
            .ToListAsync();

        var totalEggs      = records.Sum(r => r.EggsTotal);
        var totalBroken    = records.Sum(r => r.EggsBroken);
        var totalSold      = records.Sum(r => r.EggsSold);
        var totalMortality = records.Sum(r => r.Mortality);
        var totalFeedKg    = records.Sum(r => r.FeedConsumedKg);
        var daysRecorded   = records.Count;

        decimal? layingRatePercent = null;
        if (flock.BirdType == "layer" && currentBirdCount > 0 && daysRecorded > 0)
        {
            var avgDailyEggs = (decimal)totalEggs / daysRecorded;
            layingRatePercent = Math.Round(avgDailyEggs / currentBirdCount * 100, 2);
        }

        return Ok(new
        {
            flock = new
            {
                flock.Id,
                flock.BatchCode,
                flock.BirdType,
                flock.Breed,
                flock.ArrivalDate,
                flock.InitialCount,
                currentBirdCount,
                flock.Status
            },
            summary = new
            {
                dateFrom,
                dateTo,
                daysRecorded,
                totalEggs,
                totalEggsBroken = totalBroken,
                totalEggsSold = totalSold,
                netEggs = totalEggs - totalBroken,
                totalMortality,
                totalFeedConsumedKg = totalFeedKg,
                layingRatePercent
            },
            daily = records.Select(r => new
            {
                r.RecordDate,
                r.EggsTotal,
                r.EggsBroken,
                r.EggsSold,
                r.Mortality,
                r.FeedConsumedKg
            })
        });
    }

    // GET /api/v1/reports/egg-production?dateFrom=&dateTo=&flockId=
    [HttpGet("egg-production")]
    public async Task<IActionResult> EggProduction(
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo,
        [FromQuery] Guid? flockId)
    {
        if (!TryGetTenantId(out _, out var error)) return error!;

        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
            return BadRequest("dateFrom must be on or before dateTo.");

        var query = _db.DailyRecords.AsNoTracking();

        if (dateFrom.HasValue) query = query.Where(r => r.RecordDate >= dateFrom.Value);
        if (dateTo.HasValue)   query = query.Where(r => r.RecordDate <= dateTo.Value);
        if (flockId.HasValue)  query = query.Where(r => r.FlockId == flockId.Value);

        var records = await query
            .Join(_db.Flocks,
                r => r.FlockId,
                f => f.Id,
                (r, f) => new
                {
                    r.RecordDate,
                    r.FlockId,
                    f.BatchCode,
                    f.BirdType,
                    r.EggsTotal,
                    r.EggsBroken,
                    r.EggsSold,
                    r.Mortality,
                    r.FeedConsumedKg
                })
            .OrderBy(r => r.RecordDate)
            .ThenBy(r => r.BatchCode)
            .ToListAsync();

        // Daily aggregate totals (useful if multiple flocks returned)
        var dailyTotals = records
            .GroupBy(r => r.RecordDate)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                date = g.Key,
                eggsTotal = g.Sum(r => r.EggsTotal),
                eggsBroken = g.Sum(r => r.EggsBroken),
                eggsSold = g.Sum(r => r.EggsSold),
                mortality = g.Sum(r => r.Mortality),
                feedConsumedKg = g.Sum(r => r.FeedConsumedKg),
                recordCount = g.Count()
            })
            .ToList();

        // Period summary
        var periodSummary = new
        {
            totalEggs = records.Sum(r => r.EggsTotal),
            totalEggsBroken = records.Sum(r => r.EggsBroken),
            totalEggsSold = records.Sum(r => r.EggsSold),
            totalMortality = records.Sum(r => r.Mortality),
            totalFeedConsumedKg = records.Sum(r => r.FeedConsumedKg)
        };

        return Ok(new
        {
            filters = new { dateFrom, dateTo, flockId },
            periodSummary,
            dailyTotals,
            records
        });
    }

    // GET /api/v1/reports/feed-consumption?dateFrom=&dateTo=
    [HttpGet("feed-consumption")]
    public async Task<IActionResult> FeedConsumption(
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out _, out var error)) return error!;

        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
            return BadRequest("dateFrom must be on or before dateTo.");

        // Feed inventory usage (FeedStockMovements type=usage)
        var movQuery = _db.FeedStockMovements
            .AsNoTracking()
            .Where(m => m.MovementType == "usage");

        if (dateFrom.HasValue) movQuery = movQuery.Where(m => m.MovementDate >= dateFrom.Value);
        if (dateTo.HasValue)   movQuery = movQuery.Where(m => m.MovementDate <= dateTo.Value);

        var inventoryUsage = await movQuery
            .Join(_db.FeedItems,
                m => m.FeedItemId,
                f => f.Id,
                (m, f) => new { m.FeedItemId, f.Name, f.Unit, m.QuantityKg, m.FlockId })
            .GroupBy(x => new { x.FeedItemId, x.Name, x.Unit })
            .Select(g => new
            {
                feedItemId = g.Key.FeedItemId,
                name = g.Key.Name,
                unit = g.Key.Unit,
                totalUsedKg = g.Sum(x => x.QuantityKg),
                movementCount = g.Count()
            })
            .OrderByDescending(x => x.totalUsedKg)
            .ToListAsync();

        // Per-flock feed consumption from daily records
        var drQuery = _db.DailyRecords.AsNoTracking();
        if (dateFrom.HasValue) drQuery = drQuery.Where(r => r.RecordDate >= dateFrom.Value);
        if (dateTo.HasValue)   drQuery = drQuery.Where(r => r.RecordDate <= dateTo.Value);

        var flockConsumption = await drQuery
            .Join(_db.Flocks,
                r => r.FlockId,
                f => f.Id,
                (r, f) => new { r.FlockId, f.BatchCode, r.FeedConsumedKg })
            .GroupBy(x => new { x.FlockId, x.BatchCode })
            .Select(g => new
            {
                flockId = g.Key.FlockId,
                batchCode = g.Key.BatchCode,
                totalFeedConsumedKg = g.Sum(x => x.FeedConsumedKg),
                daysRecorded = g.Count()
            })
            .OrderByDescending(x => x.totalFeedConsumedKg)
            .ToListAsync();

        return Ok(new
        {
            filters = new { dateFrom, dateTo },
            inventoryUsage,
            flockConsumption,
            totals = new
            {
                totalInventoryUsedKg = inventoryUsage.Sum(x => x.totalUsedKg),
                totalFlockConsumedKg = flockConsumption.Sum(x => x.totalFeedConsumedKg)
            }
        });
    }

    // GET /api/v1/reports/finance?dateFrom=&dateTo=
    [HttpGet("finance")]
    [Authorize(Roles = "owner,farm_manager,accountant")]
    public async Task<IActionResult> Finance(
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out _, out var error)) return error!;

        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
            return BadRequest("dateFrom must be on or before dateTo.");

        var query = _db.FinancialTransactions.AsNoTracking();
        if (dateFrom.HasValue) query = query.Where(t => t.TransactionDate >= dateFrom.Value);
        if (dateTo.HasValue)   query = query.Where(t => t.TransactionDate <= dateTo.Value);

        var transactions = await query
            .OrderByDescending(t => t.TransactionDate)
            .ToListAsync();

        var totalIncome  = transactions.Where(t => t.Type == "income").Sum(t => t.Amount);
        var totalExpense = transactions.Where(t => t.Type == "expense").Sum(t => t.Amount);

        var byCategory = transactions
            .GroupBy(t => new { t.Type, t.Category })
            .Select(g => new
            {
                type = g.Key.Type,
                category = g.Key.Category,
                total = g.Sum(t => t.Amount),
                count = g.Count()
            })
            .OrderBy(x => x.type)
            .ThenByDescending(x => x.total)
            .ToList();

        return Ok(new
        {
            filters = new { dateFrom, dateTo },
            summary = new
            {
                totalIncome,
                totalExpense,
                netProfit = totalIncome - totalExpense,
                transactionCount = transactions.Count
            },
            byCategory,
            transactions
        });
    }

    private bool TryGetTenantId(out Guid tenantId, out ActionResult? errorResult)
    {
        tenantId = Guid.Empty;
        errorResult = null;

        var claim = User.FindFirst("tenantId")?.Value;
        if (Guid.TryParse(claim, out tenantId))
            return true;

        errorResult = Unauthorized("Tenant claim missing from token.");
        return false;
    }
}
