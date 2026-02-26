using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class HousesController : ControllerBase
{
    private static readonly HashSet<string> AllowedHouseTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "layer",
        "broiler",
        "grower"
    };

    private readonly AppDbContext _db;

    public HousesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("farms/{farmId:guid}/houses")]
    public async Task<ActionResult<IEnumerable<House>>> GetByFarm(Guid farmId)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var houses = await _db.Houses
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId && !h.IsDeleted && h.FarmId == farmId)
            .ToListAsync();

        return Ok(houses);
    }

    [HttpPost("farms/{farmId:guid}/houses")]
    public async Task<ActionResult<House>> Create(Guid farmId, HouseCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Name is required.");
        }

        if (request.Name.Trim().Length > 150)
        {
            return UnprocessableEntity("Name must not exceed 150 characters.");
        }

        if (!string.IsNullOrEmpty(request.Notes) && request.Notes.Length > 500)
        {
            return UnprocessableEntity("Notes must not exceed 500 characters.");
        }

        if (string.IsNullOrWhiteSpace(request.HouseType))
        {
            return UnprocessableEntity("HouseType is required.");
        }

        if (!AllowedHouseTypes.Contains(request.HouseType.Trim()))
        {
            return UnprocessableEntity("HouseType must be one of: Layer, Broiler, Grower.");
        }

        if (request.Capacity < 0)
        {
            return BadRequest("Capacity must be 0 or greater.");
        }

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);

        if (!farmExists)
        {
            return NotFound("Farm not found.");
        }

        var house = new House
        {
            TenantId = tenantId,
            FarmId = farmId,
            Name = request.Name.Trim(),
            Capacity = request.Capacity,
            HouseType = NormalizeHouseType(request.HouseType),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim()
        };

        _db.Houses.Add(house);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = house.Id }, house);
    }

    [HttpGet("houses/{id:guid}")]
    public async Task<ActionResult<House>> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var house = await _db.Houses
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId && !h.IsDeleted)
            .FirstOrDefaultAsync(h => h.Id == id);

        if (house is null)
        {
            return NotFound();
        }

        return Ok(house);
    }

    [HttpPut("houses/{id:guid}")]
    public async Task<ActionResult<House>> Update(Guid id, HouseCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Name is required.");
        }

        if (request.Name.Trim().Length > 150)
        {
            return UnprocessableEntity("Name must not exceed 150 characters.");
        }

        if (!string.IsNullOrEmpty(request.Notes) && request.Notes.Length > 500)
        {
            return UnprocessableEntity("Notes must not exceed 500 characters.");
        }

        if (string.IsNullOrWhiteSpace(request.HouseType))
        {
            return UnprocessableEntity("HouseType is required.");
        }

        if (!AllowedHouseTypes.Contains(request.HouseType.Trim()))
        {
            return UnprocessableEntity("HouseType must be one of: Layer, Broiler, Grower.");
        }

        if (request.Capacity < 0)
        {
            return BadRequest("Capacity must be 0 or greater.");
        }

        var house = await _db.Houses
            .Where(h => h.TenantId == tenantId && !h.IsDeleted)
            .FirstOrDefaultAsync(h => h.Id == id);

        if (house is null)
        {
            return NotFound();
        }

        house.Name = request.Name.Trim();
        house.Capacity = request.Capacity;
        house.HouseType = NormalizeHouseType(request.HouseType);
        house.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        house.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(house);
    }

    [HttpDelete("houses/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var house = await _db.Houses
            .Where(h => h.TenantId == tenantId && !h.IsDeleted)
            .FirstOrDefaultAsync(h => h.Id == id);

        if (house is null)
        {
            return NotFound();
        }

        house.IsDeleted = true;
        house.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return NoContent();
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

    private static string NormalizeHouseType(string value)
    {
        return value.Trim().ToLowerInvariant();
    }

    public sealed record HouseCreateRequest(string Name, int Capacity, string HouseType, string? Notes);
}
