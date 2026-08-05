using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class PregnancyRecordsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PregnancyRecordsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/pregnancies
    [HttpGet("farms/{farmId:guid}/pregnancies")]
    public async Task<ActionResult<IEnumerable<PregnancyRecord>>> GetByFarm(
        Guid farmId,
        [FromQuery] string? status,
        [FromQuery] Guid? damId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var query = _db.PregnancyRecords
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.FarmId == farmId && !p.IsDeleted);

        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(p => p.Status == status);
        if (damId.HasValue) query = query.Where(p => p.DamId == damId.Value);

        var records = await query
            .OrderByDescending(p => p.ExpectedDueDate)
            .ToListAsync();

        return Ok(records);
    }

    // POST /api/v1/farms/{farmId}/pregnancies
    [HttpPost("farms/{farmId:guid}/pregnancies")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<PregnancyRecord>> Create(Guid farmId, PregnancyRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var dam = await _db.Animals
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == request.DamId && a.TenantId == tenantId && !a.IsDeleted);
        if (dam == null) return NotFound("Dam (female animal) not found.");
        if (dam.Sex != "Female") return BadRequest("Dam must be a female animal.");

        if (request.MatingRecordId.HasValue)
        {
            var matingExists = await _db.MatingRecords
                .AsNoTracking()
                .AnyAsync(m => m.Id == request.MatingRecordId && m.TenantId == tenantId && !m.IsDeleted);
            if (!matingExists) return NotFound("Mating record not found.");
        }

        var record = new PregnancyRecord
        {
            TenantId        = tenantId,
            FarmId          = farmId,
            DamId           = request.DamId,
            MatingRecordId  = request.MatingRecordId,
            ConfirmedDate   = request.ConfirmedDate,
            ExpectedDueDate = request.ExpectedDueDate,
            Status          = request.ConfirmedDate.HasValue ? "Confirmed" : "Suspected",
            Notes           = request.Notes?.Trim(),
        };

        _db.PregnancyRecords.Add(record);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/pregnancies/{record.Id}", record);
    }

    // PATCH /api/v1/pregnancies/{id}/status
    [HttpPatch("pregnancies/{id:guid}/status")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<PregnancyRecord>> UpdateStatus(Guid id, PregnancyStatusRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var validStatuses = new HashSet<string> { "Suspected", "Confirmed", "GaveBirth", "Aborted", "NotPregnant" };
        if (!validStatuses.Contains(request.Status))
            return BadRequest("Invalid status value.");

        if (request.Status == "GaveBirth" && !request.ActualBirthDate.HasValue)
            return BadRequest("ActualBirthDate is required when status is GaveBirth.");

        var record = await _db.PregnancyRecords
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId && !p.IsDeleted);
        if (record == null) return NotFound("Pregnancy record not found.");

        record.Status = request.Status;
        if (request.ActualBirthDate.HasValue)
            record.ActualBirthDate = request.ActualBirthDate;

        await _db.SaveChangesAsync();
        return Ok(record);
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

public record PregnancyRequest(
    Guid DamId,
    DateOnly ExpectedDueDate,
    DateOnly? ConfirmedDate,
    Guid? MatingRecordId,
    string? Notes);

public record PregnancyStatusRequest(
    string Status,
    DateOnly? ActualBirthDate);
