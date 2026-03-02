using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class SpeciesController : ControllerBase
{
    private readonly AppDbContext _db;

    public SpeciesController(AppDbContext db) => _db = db;

    // GET /api/v1/species
    [HttpGet("species")]
    public async Task<ActionResult<IEnumerable<Species>>> GetAll()
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var list = await _db.Species
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && !s.IsDeleted)
            .OrderBy(s => s.Name)
            .ToListAsync();

        return Ok(list);
    }

    // GET /api/v1/species/{id}
    [HttpGet("species/{id:guid}")]
    public async Task<ActionResult<Species>> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var species = await _db.Species
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId && !s.IsDeleted)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (species is null) return NotFound();
        return Ok(species);
    }

    // POST /api/v1/species
    [HttpPost("species")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<Species>> Create(SpeciesRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest("Code is required.");
        if (request.Name.Length > 80)
            return BadRequest("Name must be at most 80 characters.");
        if (request.Code.Length > 30)
            return BadRequest("Code must be at most 30 characters.");

        var codeNorm = request.Code.Trim().ToLowerInvariant();
        var nameNorm = request.Name.Trim();

        var duplicate = await _db.Species
            .AsNoTracking()
            .AnyAsync(s => s.TenantId == tenantId && !s.IsDeleted &&
                           (s.Code == codeNorm || s.Name == nameNorm));
        if (duplicate)
            return Conflict("A species with the same name or code already exists.");

        var species = new Species
        {
            TenantId          = tenantId,
            Name              = nameNorm,
            Code              = codeNorm,
            TracksIndividuals = request.TracksIndividuals,
            IsDairy           = request.IsDairy,
            IsEggLayer        = request.IsEggLayer,
            IsWool            = request.IsWool,
        };

        _db.Species.Add(species);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = species.Id }, species);
    }

    // PUT /api/v1/species/{id}
    [HttpPut("species/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<Species>> Update(Guid id, SpeciesRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest("Code is required.");

        var species = await _db.Species
            .Where(s => s.TenantId == tenantId && !s.IsDeleted)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (species is null) return NotFound();

        var codeNorm = request.Code.Trim().ToLowerInvariant();
        var nameNorm = request.Name.Trim();

        var duplicate = await _db.Species
            .AsNoTracking()
            .AnyAsync(s => s.TenantId == tenantId && !s.IsDeleted && s.Id != id &&
                           (s.Code == codeNorm || s.Name == nameNorm));
        if (duplicate)
            return Conflict("Another species with the same name or code already exists.");

        species.Name              = nameNorm;
        species.Code              = codeNorm;
        species.TracksIndividuals = request.TracksIndividuals;
        species.IsDairy           = request.IsDairy;
        species.IsEggLayer        = request.IsEggLayer;
        species.IsWool            = request.IsWool;

        await _db.SaveChangesAsync();
        return Ok(species);
    }

    // DELETE /api/v1/species/{id}
    [HttpDelete("species/{id:guid}")]
    [Authorize(Roles = "owner")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var species = await _db.Species
            .Where(s => s.TenantId == tenantId && !s.IsDeleted)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (species is null) return NotFound();

        species.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
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

public record SpeciesRequest(
    string Name,
    string Code,
    bool TracksIndividuals,
    bool IsDairy,
    bool IsEggLayer,
    bool IsWool);
