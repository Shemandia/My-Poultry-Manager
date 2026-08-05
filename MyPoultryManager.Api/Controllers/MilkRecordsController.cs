using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class MilkRecordsController : ControllerBase
{
    private readonly AppDbContext _db;

    public MilkRecordsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/milk
    [HttpGet("farms/{farmId:guid}/milk")]
    public async Task<ActionResult<IEnumerable<MilkRecord>>> GetByFarm(
        Guid farmId,
        [FromQuery] Guid? animalId,
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var query = _db.MilkRecords
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.FarmId == farmId && !m.IsDeleted);

        if (animalId.HasValue)  query = query.Where(m => m.AnimalId == animalId.Value);
        if (dateFrom.HasValue)  query = query.Where(m => m.RecordDate >= dateFrom.Value);
        if (dateTo.HasValue)    query = query.Where(m => m.RecordDate <= dateTo.Value);

        var records = await query.OrderByDescending(m => m.RecordDate).ToListAsync();
        return Ok(records);
    }

    // POST /api/v1/farms/{farmId}/milk
    [HttpPost("farms/{farmId:guid}/milk")]
    [Authorize(Roles = "owner,farm_manager,supervisor,worker")]
    public async Task<ActionResult<MilkRecord>> Create(Guid farmId, MilkRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var validSessions = new HashSet<string> { "Morning", "Evening", "FullDay" };
        if (!validSessions.Contains(request.Session))
            return BadRequest("Session must be Morning, Evening, or FullDay.");

        if (request.QuantityLitres < 0)
            return BadRequest("QuantityLitres cannot be negative.");

        if (request.AnimalId.HasValue)
        {
            var animalExists = await _db.Animals
                .AsNoTracking()
                .AnyAsync(a => a.Id == request.AnimalId && a.TenantId == tenantId && !a.IsDeleted);
            if (!animalExists) return NotFound("Animal not found.");
        }

        var record = new MilkRecord
        {
            TenantId       = tenantId,
            FarmId         = farmId,
            SpeciesId      = request.SpeciesId,
            AnimalId       = request.AnimalId,
            GroupId        = request.GroupId,
            RecordDate     = request.RecordDate,
            Session        = request.Session,
            QuantityLitres = request.QuantityLitres,
            Notes          = request.Notes?.Trim(),
        };

        _db.MilkRecords.Add(record);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/milk/{record.Id}", record);
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

public record MilkRequest(
    Guid SpeciesId,
    DateOnly RecordDate,
    string Session,
    decimal QuantityLitres,
    Guid? AnimalId,
    Guid? GroupId,
    string? Notes);
