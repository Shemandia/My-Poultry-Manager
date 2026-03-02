using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class AnimalGroupsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnimalGroupsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/groups
    [HttpGet("farms/{farmId:guid}/groups")]
    public async Task<ActionResult<IEnumerable<AnimalGroup>>> GetByFarm(Guid farmId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var groups = await _db.AnimalGroups
            .AsNoTracking()
            .Where(g => g.TenantId == tenantId && g.FarmId == farmId && !g.IsDeleted)
            .OrderByDescending(g => g.StartDate)
            .ToListAsync();

        return Ok(groups);
    }

    // POST /api/v1/farms/{farmId}/groups
    [HttpPost("farms/{farmId:guid}/groups")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<AnimalGroup>> Create(Guid farmId, AnimalGroupRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.GroupCode))
            return BadRequest("GroupCode is required.");
        if (request.GroupCode.Length > 50)
            return BadRequest("GroupCode must be at most 50 characters.");
        if (request.InitialCount < 1)
            return BadRequest("InitialCount must be at least 1.");
        if (request.CurrentCount < 0)
            return BadRequest("CurrentCount cannot be negative.");

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var speciesExists = await _db.Species
            .AsNoTracking()
            .AnyAsync(s => s.Id == request.SpeciesId && s.TenantId == tenantId && !s.IsDeleted);
        if (!speciesExists) return NotFound("Species not found.");

        var codeNorm = request.GroupCode.Trim().ToUpperInvariant();
        var duplicate = await _db.AnimalGroups
            .AsNoTracking()
            .AnyAsync(g => g.TenantId == tenantId && g.FarmId == farmId &&
                           g.GroupCode == codeNorm && !g.IsDeleted);
        if (duplicate)
            return Conflict("A group with this code already exists on this farm.");

        var group = new AnimalGroup
        {
            TenantId     = tenantId,
            FarmId       = farmId,
            LocationId   = request.LocationId,
            SpeciesId    = request.SpeciesId,
            BreedId      = request.BreedId,
            GroupCode    = codeNorm,
            Name         = request.Name?.Trim(),
            StartDate    = request.StartDate.ToUniversalTime(),
            InitialCount = request.InitialCount,
            CurrentCount = request.CurrentCount,
            Status       = "Active",
        };

        _db.AnimalGroups.Add(group);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/groups/{group.Id}", group);
    }

    // PATCH /api/v1/groups/{id}/close
    [HttpPatch("groups/{id:guid}/close")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> Close(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var group = await _db.AnimalGroups
            .Where(g => g.TenantId == tenantId && !g.IsDeleted)
            .FirstOrDefaultAsync(g => g.Id == id);
        if (group is null) return NotFound();
        if (group.Status == "Closed") return Conflict("Group is already closed.");

        group.Status     = "Closed";
        group.ClosedDate = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(group);
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

public record AnimalGroupRequest(
    Guid SpeciesId,
    string GroupCode,
    DateTime StartDate,
    int InitialCount,
    int CurrentCount,
    Guid? LocationId,
    Guid? BreedId,
    string? Name);
