using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Authorize]
public class HarvestRecordsController : ControllerBase
{
    private readonly AppDbContext _db;

    public HarvestRecordsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/flocks/{flockId}/harvest-records
    [HttpGet("api/v1/flocks/{flockId:guid}/harvest-records")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> GetAll(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flockExists = await _db.Flocks.AnyAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (!flockExists) return NotFound("Flock not found.");

        var records = await _db.HarvestRecords
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId && h.FlockId == flockId)
            .OrderByDescending(h => h.HarvestDate)
            .ToListAsync();

        return Ok(records);
    }

    // POST /api/v1/flocks/{flockId}/harvest-records
    [HttpPost("api/v1/flocks/{flockId:guid}/harvest-records")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> Create(Guid flockId, HarvestRecordRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flock = await _db.Flocks.FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (flock is null) return NotFound("Flock not found.");

        if (request.HarvestDate == default) return BadRequest("HarvestDate is required.");
        if (request.BirdsHarvested <= 0) return BadRequest("BirdsHarvested must be greater than zero.");

        var record = new HarvestRecord
        {
            TenantId = tenantId,
            FlockId = flockId,
            HarvestDate = request.HarvestDate,
            BirdsHarvested = request.BirdsHarvested,
            AvgWeightKg = request.AvgWeightKg,
            TotalWeightKg = request.TotalWeightKg,
            BuyerName = request.BuyerName?.Trim(),
            PricePerKg = request.PricePerKg,
            Notes = request.Notes?.Trim()
        };

        _db.HarvestRecords.Add(record);
        await _db.SaveChangesAsync();

        return StatusCode(201, record);
    }

    // PUT /api/v1/harvest-records/{id}
    [HttpPut("api/v1/harvest-records/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> Update(Guid id, HarvestRecordRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var record = await _db.HarvestRecords
            .FirstOrDefaultAsync(h => h.TenantId == tenantId && h.Id == id);

        if (record is null) return NotFound();

        record.HarvestDate = request.HarvestDate;
        record.BirdsHarvested = request.BirdsHarvested;
        record.AvgWeightKg = request.AvgWeightKg;
        record.TotalWeightKg = request.TotalWeightKg;
        record.BuyerName = request.BuyerName?.Trim();
        record.PricePerKg = request.PricePerKg;
        record.Notes = request.Notes?.Trim();

        await _db.SaveChangesAsync();
        return Ok(record);
    }

    // DELETE /api/v1/harvest-records/{id}
    [HttpDelete("api/v1/harvest-records/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var record = await _db.HarvestRecords
            .FirstOrDefaultAsync(h => h.TenantId == tenantId && h.Id == id);

        if (record is null) return NotFound();

        record.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    public sealed record HarvestRecordRequest(
        DateOnly HarvestDate,
        int BirdsHarvested,
        decimal? AvgWeightKg,
        decimal? TotalWeightKg,
        string? BuyerName,
        decimal? PricePerKg,
        string? Notes
    );
}
