using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class BreedsController : ControllerBase
{
    private readonly AppDbContext _db;

    public BreedsController(AppDbContext db) => _db = db;

    // GET /api/v1/species/{speciesId}/breeds
    [HttpGet("species/{speciesId:guid}/breeds")]
    public async Task<ActionResult<IEnumerable<Breed>>> GetBySpecies(Guid speciesId)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var speciesExists = await _db.Species
            .AsNoTracking()
            .AnyAsync(s => s.Id == speciesId && s.TenantId == tenantId && !s.IsDeleted);
        if (!speciesExists) return NotFound("Species not found.");

        var breeds = await _db.Breeds
            .AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.SpeciesId == speciesId && !b.IsDeleted)
            .OrderBy(b => b.Name)
            .ToListAsync();

        return Ok(breeds);
    }

    // POST /api/v1/species/{speciesId}/breeds
    [HttpPost("species/{speciesId:guid}/breeds")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<Breed>> Create(Guid speciesId, BreedRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        if (request.Name.Length > 100)
            return BadRequest("Name must be at most 100 characters.");

        var speciesExists = await _db.Species
            .AsNoTracking()
            .AnyAsync(s => s.Id == speciesId && s.TenantId == tenantId && !s.IsDeleted);
        if (!speciesExists) return NotFound("Species not found.");

        var nameNorm = request.Name.Trim();

        var duplicate = await _db.Breeds
            .AsNoTracking()
            .AnyAsync(b => b.TenantId == tenantId && b.SpeciesId == speciesId &&
                           b.Name == nameNorm && !b.IsDeleted);
        if (duplicate)
            return Conflict("A breed with this name already exists for this species.");

        var breed = new Breed
        {
            TenantId  = tenantId,
            SpeciesId = speciesId,
            Name      = nameNorm,
        };

        _db.Breeds.Add(breed);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/species/{speciesId}/breeds/{breed.Id}", breed);
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

public record BreedRequest(string Name);
