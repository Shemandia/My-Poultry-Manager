using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class BirthRecordsController : ControllerBase
{
    private readonly AppDbContext _db;

    public BirthRecordsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/births
    [HttpGet("farms/{farmId:guid}/births")]
    public async Task<ActionResult<IEnumerable<BirthRecord>>> GetByFarm(
        Guid farmId,
        [FromQuery] Guid? damId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var query = _db.BirthRecords
            .AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.FarmId == farmId && !b.IsDeleted);

        if (damId.HasValue) query = query.Where(b => b.DamId == damId.Value);

        var records = await query
            .OrderByDescending(b => b.BirthDate)
            .ToListAsync();

        return Ok(records);
    }

    // POST /api/v1/farms/{farmId}/births
    [HttpPost("farms/{farmId:guid}/births")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<BirthRecord>> Create(Guid farmId, BirthRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        // Validate dam
        var dam = await _db.Animals
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == request.DamId && a.TenantId == tenantId && !a.IsDeleted);
        if (dam == null) return NotFound("Dam (female animal) not found.");
        if (dam.Sex != "Female") return BadRequest("Dam must be a female animal.");

        // Validate internal sire if provided
        if (request.SireId.HasValue)
        {
            var sire = await _db.Animals
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == request.SireId && a.TenantId == tenantId && !a.IsDeleted);
            if (sire == null) return NotFound("Sire (male animal) not found.");
            if (sire.Sex != "Male") return BadRequest("Sire must be a male animal.");
        }

        // Validate linked pregnancy record
        PregnancyRecord? pregnancy = null;
        if (request.PregnancyRecordId.HasValue)
        {
            pregnancy = await _db.PregnancyRecords
                .FirstOrDefaultAsync(p => p.Id == request.PregnancyRecordId && p.TenantId == tenantId && !p.IsDeleted);
            if (pregnancy == null) return NotFound("Pregnancy record not found.");
        }

        var validTypes = new HashSet<string> { "Single", "Twins", "Triplets", "Other" };
        if (!validTypes.Contains(request.BirthType))
            return BadRequest("BirthType must be Single, Twins, Triplets, or Other.");

        if (request.TotalBorn < 1) return BadRequest("TotalBorn must be at least 1.");
        if (request.LiveBorn < 0 || request.Stillborn < 0) return BadRequest("Counts cannot be negative.");
        if (request.LiveBorn + request.Stillborn > request.TotalBorn)
            return BadRequest("LiveBorn + Stillborn cannot exceed TotalBorn.");

        var record = new BirthRecord
        {
            TenantId          = tenantId,
            FarmId            = farmId,
            DamId             = request.DamId,
            SireId            = request.SireId,
            SireTag           = request.SireTag?.Trim(),
            PregnancyRecordId = request.PregnancyRecordId,
            BirthDate         = request.BirthDate,
            TotalBorn         = request.TotalBorn,
            LiveBorn          = request.LiveBorn,
            Stillborn         = request.Stillborn,
            BirthType         = request.BirthType,
            Complications     = request.Complications?.Trim(),
            Notes             = request.Notes?.Trim(),
        };

        _db.BirthRecords.Add(record);

        // Auto-update linked pregnancy to GaveBirth
        if (pregnancy != null)
        {
            pregnancy.Status = "GaveBirth";
            pregnancy.ActualBirthDate = request.BirthDate;
        }

        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/births/{record.Id}", record);
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

public record BirthRequest(
    Guid DamId,
    DateOnly BirthDate,
    int TotalBorn,
    int LiveBorn,
    int Stillborn,
    string BirthType,
    Guid? SireId,
    string? SireTag,
    Guid? PregnancyRecordId,
    string? Complications,
    string? Notes);
