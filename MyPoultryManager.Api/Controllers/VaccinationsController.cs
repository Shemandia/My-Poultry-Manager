using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Authorize]
public class VaccinationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public VaccinationsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/flocks/{flockId}/vaccinations
    [HttpGet("api/v1/flocks/{flockId:guid}/vaccinations")]
    public async Task<IActionResult> GetAll(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flockExists = await _db.Flocks.AnyAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (!flockExists) return NotFound("Flock not found.");

        var schedules = await _db.VaccinationSchedules
            .AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.FlockId == flockId)
            .OrderBy(v => v.ScheduledDate)
            .ToListAsync();

        return Ok(schedules);
    }

    // POST /api/v1/flocks/{flockId}/vaccinations
    [HttpPost("api/v1/flocks/{flockId:guid}/vaccinations")]
    [Authorize(Roles = "owner,farm_manager,vet")]
    public async Task<IActionResult> Create(Guid flockId, VaccinationCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flock = await _db.Flocks.FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (flock is null) return NotFound("Flock not found.");

        if (string.IsNullOrWhiteSpace(request.VaccineName))
            return BadRequest("VaccineName is required.");

        if (request.ScheduledDate == default)
            return BadRequest("ScheduledDate is required.");

        var schedule = new VaccinationSchedule
        {
            TenantId = tenantId,
            FlockId = flockId,
            VaccineName = request.VaccineName.Trim(),
            ScheduledDate = request.ScheduledDate,
            Notes = request.Notes?.Trim()
        };

        _db.VaccinationSchedules.Add(schedule);
        await _db.SaveChangesAsync();

        return StatusCode(201, schedule);
    }

    // PUT /api/v1/vaccinations/{id}
    [HttpPut("api/v1/vaccinations/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager,vet")]
    public async Task<IActionResult> Update(Guid id, VaccinationCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var schedule = await _db.VaccinationSchedules
            .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id);

        if (schedule is null) return NotFound();

        if (string.IsNullOrWhiteSpace(request.VaccineName))
            return BadRequest("VaccineName is required.");

        if (request.ScheduledDate == default)
            return BadRequest("ScheduledDate is required.");

        schedule.VaccineName = request.VaccineName.Trim();
        schedule.ScheduledDate = request.ScheduledDate;
        schedule.Notes = request.Notes?.Trim();
        await _db.SaveChangesAsync();

        return Ok(schedule);
    }

    // PATCH /api/v1/vaccinations/{id}/mark-given
    [HttpPatch("api/v1/vaccinations/{id:guid}/mark-given")]
    [Authorize(Roles = "owner,farm_manager,supervisor,vet")]
    public async Task<IActionResult> MarkGiven(Guid id, MarkGivenRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var schedule = await _db.VaccinationSchedules
            .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id);

        if (schedule is null) return NotFound();

        schedule.GivenDate = request.GivenDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(schedule);
    }

    // DELETE /api/v1/vaccinations/{id}
    [HttpDelete("api/v1/vaccinations/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager,vet")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var schedule = await _db.VaccinationSchedules
            .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id);

        if (schedule is null) return NotFound();

        schedule.IsDeleted = true;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    public sealed record VaccinationCreateRequest(
        string VaccineName,
        DateOnly ScheduledDate,
        string? Notes
    );

    public sealed record MarkGivenRequest(DateOnly? GivenDate);
}
