using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class LocationsController : ControllerBase
{
    private readonly AppDbContext _db;

    private static readonly HashSet<string> ValidTypes =
        new(StringComparer.OrdinalIgnoreCase)
        { "Barn", "Paddock", "Pen", "House", "Shed", "Other" };

    public LocationsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/locations
    [HttpGet("farms/{farmId:guid}/locations")]
    public async Task<ActionResult<IEnumerable<Location>>> GetByFarm(Guid farmId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var locations = await _db.Locations
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId && l.FarmId == farmId && !l.IsDeleted)
            .OrderBy(l => l.Name)
            .ToListAsync();

        return Ok(locations);
    }

    // POST /api/v1/farms/{farmId}/locations
    [HttpPost("farms/{farmId:guid}/locations")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<Location>> Create(Guid farmId, LocationRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        if (string.IsNullOrWhiteSpace(request.LocationType))
            return BadRequest("LocationType is required.");
        if (!ValidTypes.Contains(request.LocationType))
            return BadRequest($"LocationType must be one of: {string.Join(", ", ValidTypes)}.");
        if (request.Name.Length > 150)
            return BadRequest("Name must be at most 150 characters.");

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var nameNorm = request.Name.Trim();
        var duplicate = await _db.Locations
            .AsNoTracking()
            .AnyAsync(l => l.TenantId == tenantId && l.FarmId == farmId &&
                           l.Name == nameNorm && !l.IsDeleted);
        if (duplicate)
            return Conflict("A location with this name already exists on this farm.");

        var location = new Location
        {
            TenantId     = tenantId,
            FarmId       = farmId,
            Name         = nameNorm,
            LocationType = request.LocationType.Trim(),
            Capacity     = request.Capacity,
            Notes        = request.Notes?.Trim(),
        };

        _db.Locations.Add(location);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/locations/{location.Id}", location);
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

public record LocationRequest(
    string Name,
    string LocationType,
    int Capacity,
    string? Notes);
