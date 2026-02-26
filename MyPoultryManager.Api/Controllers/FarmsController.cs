using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/farms")]
[Authorize]
public class FarmsController : ControllerBase
{
    private readonly AppDbContext _db;

    public FarmsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Farm>>> GetAll()
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var farms = await _db.Farms
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .ToListAsync();

        return Ok(farms);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Farm>> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var farm = await _db.Farms
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (farm is null)
        {
            return NotFound();
        }

        return Ok(farm);
    }

    [HttpPost]
    public async Task<ActionResult<Farm>> Create(FarmCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Name is required.");
        }

        var farm = new Farm
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            Location = request.Location,
            Capacity = request.Capacity
        };

        _db.Farms.Add(farm);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = farm.Id }, farm);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Farm>> Update(Guid id, FarmUpdateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Name is required.");
        }

        var farm = await _db.Farms
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (farm is null)
        {
            return NotFound();
        }

        farm.Name = request.Name.Trim();
        farm.Location = request.Location;
        farm.Capacity = request.Capacity;
        farm.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(farm);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var farm = await _db.Farms
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (farm is null)
        {
            return NotFound();
        }

        farm.IsDeleted = true;
        farm.UpdatedAt = DateTime.UtcNow;

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

    public sealed record FarmCreateRequest(string Name, string? Location, int? Capacity);

    public sealed record FarmUpdateRequest(string Name, string? Location, int? Capacity);
}
