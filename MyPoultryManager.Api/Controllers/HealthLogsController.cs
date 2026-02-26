using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Authorize]
public class HealthLogsController : ControllerBase
{
    private readonly AppDbContext _db;

    public HealthLogsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/flocks/{flockId}/health-logs
    [HttpGet("api/v1/flocks/{flockId:guid}/health-logs")]
    [Authorize(Roles = "owner,farm_manager,supervisor,vet")]
    public async Task<IActionResult> GetAll(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flockExists = await _db.Flocks.AnyAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (!flockExists) return NotFound("Flock not found.");

        var logs = await _db.HealthLogs
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId && h.FlockId == flockId)
            .OrderByDescending(h => h.LogDate)
            .ToListAsync();

        return Ok(logs);
    }

    // POST /api/v1/flocks/{flockId}/health-logs
    [HttpPost("api/v1/flocks/{flockId:guid}/health-logs")]
    [Authorize(Roles = "owner,farm_manager,supervisor,vet")]
    public async Task<IActionResult> Create(Guid flockId, HealthLogCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flock = await _db.Flocks.FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (flock is null) return NotFound("Flock not found.");

        if (request.LogDate == default)
            return BadRequest("LogDate is required.");

        var log = new HealthLog
        {
            TenantId = tenantId,
            FlockId = flockId,
            LogDate = request.LogDate,
            Symptoms = request.Symptoms?.Trim(),
            Diagnosis = request.Diagnosis?.Trim(),
            Treatment = request.Treatment?.Trim(),
            Medication = request.Medication?.Trim(),
            DosageMl = request.DosageMl,
            VetName = request.VetName?.Trim(),
            FollowUpDate = request.FollowUpDate,
            Notes = request.Notes?.Trim()
        };

        _db.HealthLogs.Add(log);
        await _db.SaveChangesAsync();

        return StatusCode(201, log);
    }

    // GET /api/v1/health-logs/{id}
    [HttpGet("api/v1/health-logs/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager,supervisor,vet")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var log = await _db.HealthLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.TenantId == tenantId && h.Id == id);

        if (log is null) return NotFound();
        return Ok(log);
    }

    // PUT /api/v1/health-logs/{id}
    [HttpPut("api/v1/health-logs/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager,vet")]
    public async Task<IActionResult> Update(Guid id, HealthLogCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var log = await _db.HealthLogs
            .FirstOrDefaultAsync(h => h.TenantId == tenantId && h.Id == id);

        if (log is null) return NotFound();

        log.LogDate = request.LogDate;
        log.Symptoms = request.Symptoms?.Trim();
        log.Diagnosis = request.Diagnosis?.Trim();
        log.Treatment = request.Treatment?.Trim();
        log.Medication = request.Medication?.Trim();
        log.DosageMl = request.DosageMl;
        log.VetName = request.VetName?.Trim();
        log.FollowUpDate = request.FollowUpDate;
        log.Notes = request.Notes?.Trim();

        await _db.SaveChangesAsync();
        return Ok(log);
    }

    // DELETE /api/v1/health-logs/{id}
    [HttpDelete("api/v1/health-logs/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager,vet")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var log = await _db.HealthLogs
            .FirstOrDefaultAsync(h => h.TenantId == tenantId && h.Id == id);

        if (log is null) return NotFound();

        log.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    public sealed record HealthLogCreateRequest(
        DateOnly LogDate,
        string? Symptoms,
        string? Diagnosis,
        string? Treatment,
        string? Medication,
        decimal? DosageMl,
        string? VetName,
        DateOnly? FollowUpDate,
        string? Notes
    );
}
