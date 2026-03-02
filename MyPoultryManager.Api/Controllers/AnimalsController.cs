using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class AnimalsController : ControllerBase
{
    private readonly AppDbContext _db;

    private static readonly HashSet<string> ValidSex =
        new(StringComparer.OrdinalIgnoreCase) { "Male", "Female", "Unknown" };

    public AnimalsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/animals
    [HttpGet("farms/{farmId:guid}/animals")]
    public async Task<ActionResult<IEnumerable<Animal>>> GetByFarm(Guid farmId,
        [FromQuery] Guid? speciesId,
        [FromQuery] Guid? groupId,
        [FromQuery] string? status)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var query = _db.Animals
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.FarmId == farmId && !a.IsDeleted);

        if (speciesId.HasValue) query = query.Where(a => a.SpeciesId == speciesId.Value);
        if (groupId.HasValue)   query = query.Where(a => a.GroupId == groupId.Value);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(a => a.Status == status);

        var animals = await query.OrderBy(a => a.TagNumber).ToListAsync();
        return Ok(animals);
    }

    // POST /api/v1/farms/{farmId}/animals
    [HttpPost("farms/{farmId:guid}/animals")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<Animal>> Create(Guid farmId, AnimalRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.TagNumber))
            return BadRequest("TagNumber is required.");
        if (string.IsNullOrWhiteSpace(request.Sex))
            return BadRequest("Sex is required.");
        if (!ValidSex.Contains(request.Sex))
            return BadRequest("Sex must be Male, Female, or Unknown.");
        if (request.TagNumber.Length > 60)
            return BadRequest("TagNumber must be at most 60 characters.");

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var speciesExists = await _db.Species
            .AsNoTracking()
            .AnyAsync(s => s.Id == request.SpeciesId && s.TenantId == tenantId && !s.IsDeleted);
        if (!speciesExists) return NotFound("Species not found.");

        var tagNorm = request.TagNumber.Trim();
        var duplicate = await _db.Animals
            .AsNoTracking()
            .AnyAsync(a => a.TenantId == tenantId && a.TagNumber == tagNorm && !a.IsDeleted);
        if (duplicate)
            return Conflict("An animal with this tag number already exists.");

        var animal = new Animal
        {
            TenantId  = tenantId,
            FarmId    = farmId,
            SpeciesId = request.SpeciesId,
            BreedId   = request.BreedId,
            GroupId   = request.GroupId,
            TagNumber = tagNorm,
            Name      = request.Name?.Trim(),
            Sex       = request.Sex.Trim(),
            BirthDate = request.BirthDate.HasValue ? request.BirthDate.Value.ToUniversalTime() : null,
            Status    = "Alive",
            Notes     = request.Notes?.Trim(),
        };

        _db.Animals.Add(animal);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/animals/{animal.Id}", animal);
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

public record AnimalRequest(
    Guid SpeciesId,
    string TagNumber,
    string Sex,
    Guid? BreedId,
    Guid? GroupId,
    string? Name,
    DateTime? BirthDate,
    string? Notes);
