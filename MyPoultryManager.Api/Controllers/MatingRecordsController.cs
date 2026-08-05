using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class MatingRecordsController : ControllerBase
{
    private readonly AppDbContext _db;

    public MatingRecordsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/matings
    [HttpGet("farms/{farmId:guid}/matings")]
    public async Task<ActionResult<IEnumerable<MatingRecord>>> GetByFarm(
        Guid farmId,
        [FromQuery] Guid? damId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var query = _db.MatingRecords
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.FarmId == farmId && !m.IsDeleted);

        if (damId.HasValue) query = query.Where(m => m.DamId == damId.Value);

        var records = await query
            .OrderByDescending(m => m.MatingDate)
            .ToListAsync();

        return Ok(records);
    }

    // POST /api/v1/farms/{farmId}/matings
    [HttpPost("farms/{farmId:guid}/matings")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<MatingRecord>> Create(Guid farmId, MatingRequest request)
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

        var validMethods = new HashSet<string> { "Natural", "AI", "ET" };
        if (!validMethods.Contains(request.MatingMethod))
            return BadRequest("MatingMethod must be Natural, AI, or ET.");

        var record = new MatingRecord
        {
            TenantId      = tenantId,
            FarmId        = farmId,
            DamId         = request.DamId,
            SireId        = request.SireId,
            SireTag       = request.SireTag?.Trim(),
            MatingDate    = request.MatingDate,
            MatingMethod  = request.MatingMethod,
            Notes         = request.Notes?.Trim(),
        };

        _db.MatingRecords.Add(record);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/matings/{record.Id}", record);
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

public record MatingRequest(
    Guid DamId,
    DateOnly MatingDate,
    string MatingMethod,
    Guid? SireId,
    string? SireTag,
    string? Notes);
