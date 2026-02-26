using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/alerts")]
[Authorize]
public class AlertsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AlertsController(AppDbContext db) => _db = db;

    // GET /api/v1/alerts — computed, no DB table; returns live data
    [HttpGet]
    public async Task<IActionResult> GetAlerts()
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var alerts = new List<Alert>();

        // ── 1. Low feed stock ─────────────────────────────────────────────────
        var lowStock = await _db.FeedItems
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId
                     && f.LowStockThresholdKg.HasValue
                     && f.CurrentStockKg <= f.LowStockThresholdKg.Value)
            .ToListAsync();

        foreach (var item in lowStock)
        {
            alerts.Add(new Alert(
                "low_feed_stock",
                "warning",
                "Low Feed Stock",
                $"{item.Name} is running low — {item.CurrentStockKg:F1} kg remaining (threshold: {item.LowStockThresholdKg:F0} kg).",
                item.Id,
                "feed_item"
            ));
        }

        // ── 2. Vaccinations due in the next 7 days (not yet given) ────────────
        var dueWindow = today.AddDays(7);
        var pendingVaccines = await _db.VaccinationSchedules
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId
                     && v.GivenDate == null
                     && v.ScheduledDate <= dueWindow)
            .Join(_db.Flocks.AsNoTracking(),
                v => v.FlockId,
                f => f.Id,
                (v, f) => new { v.Id, v.VaccineName, v.ScheduledDate, v.FlockId, f.BatchCode })
            .ToListAsync();

        foreach (var v in pendingVaccines)
        {
            var overdue = v.ScheduledDate < today;
            alerts.Add(new Alert(
                "vaccination_due",
                overdue ? "danger" : "warning",
                overdue ? "Vaccination Overdue" : "Vaccination Due Soon",
                $"{v.VaccineName} for flock {v.BatchCode} {(overdue ? $"was due on {v.ScheduledDate}" : $"is due on {v.ScheduledDate}")}.",
                v.FlockId,
                "flock"
            ));
        }

        // ── 3. Health follow-ups due or overdue ───────────────────────────────
        var overdueFollowUps = await _db.HealthLogs
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId
                     && h.FollowUpDate.HasValue
                     && h.FollowUpDate.Value <= today)
            .Join(_db.Flocks.AsNoTracking(),
                h => h.FlockId,
                f => f.Id,
                (h, f) => new { h.Id, h.FollowUpDate, h.FlockId, f.BatchCode })
            .ToListAsync();

        foreach (var fu in overdueFollowUps)
        {
            var dateStr = fu.FollowUpDate!.Value < today
                ? $"was due on {fu.FollowUpDate.Value}"
                : "is due today";

            alerts.Add(new Alert(
                "followup_due",
                fu.FollowUpDate.Value < today ? "danger" : "warning",
                "Health Follow-up Due",
                $"Health follow-up for flock {fu.BatchCode} {dateStr}.",
                fu.FlockId,
                "flock"
            ));
        }

        // ── 4. High daily mortality (≥ 3 % of initial count, last 7 days) ─────
        var since = today.AddDays(-7);
        var activeFlocks = await _db.Flocks
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.Status == "active")
            .ToListAsync();

        if (activeFlocks.Count > 0)
        {
            var activeFlocksIds = activeFlocks.Select(f => f.Id).ToList();
            var recentRecords = await _db.DailyRecords
                .AsNoTracking()
                .Where(r => r.TenantId == tenantId
                         && activeFlocksIds.Contains(r.FlockId)
                         && r.RecordDate >= since
                         && r.Mortality > 0)
                .ToListAsync();

            foreach (var flock in activeFlocks)
            {
                if (flock.InitialCount <= 0) continue;
                foreach (var record in recentRecords.Where(r => r.FlockId == flock.Id))
                {
                    var rate = (double)record.Mortality / flock.InitialCount * 100;
                    if (rate >= 3.0)
                    {
                        alerts.Add(new Alert(
                            "high_mortality",
                            "danger",
                            "High Mortality Alert",
                            $"Flock {flock.BatchCode} recorded {record.Mortality} deaths ({rate:F1}% rate) on {record.RecordDate}.",
                            flock.Id,
                            "flock"
                        ));
                    }
                }
            }
        }

        // Sort: danger first, then warning
        var sorted = alerts
            .OrderBy(a => a.Severity == "danger" ? 0 : 1)
            .ThenBy(a => a.Type)
            .ToList();

        return Ok(new { totalCount = sorted.Count, alerts = sorted });
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    public sealed record Alert(
        string Type,
        string Severity,    // "warning" | "danger"
        string Title,
        string Message,
        Guid RelatedId,
        string RelatedType  // "flock" | "feed_item"
    );
}
