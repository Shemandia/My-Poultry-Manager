using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class FlocksController : ControllerBase
{
    private static readonly HashSet<string> AllowedBirdTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "layer",
        "broiler"
    };

    private readonly AppDbContext _db;

    public FlocksController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/flocks — all flocks for the tenant across all farms
    [HttpGet("flocks")]
    public async Task<ActionResult<IEnumerable<Flock>>> GetAll()
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
            return errorResult!;

        var flocks = await _db.Flocks
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        return Ok(flocks);
    }

    [HttpGet("farms/{farmId:guid}/flocks")]
    public async Task<ActionResult<IEnumerable<Flock>>> GetByFarm(Guid farmId)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var flocks = await _db.Flocks
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted && f.FarmId == farmId)
            .ToListAsync();

        return Ok(flocks);
    }

    [HttpPost("farms/{farmId:guid}/flocks")]
    public async Task<ActionResult<Flock>> Create(Guid farmId, FlockCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var validation = ValidateFlockRequest(request);
        if (validation is not null)
        {
            return validation;
        }

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);

        if (!farmExists)
        {
            return NotFound("Farm not found.");
        }

        var house = await _db.Houses
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId && !h.IsDeleted)
            .FirstOrDefaultAsync(h => h.Id == request.HouseId);

        if (house is null)
        {
            return NotFound("House not found.");
        }

        if (house.FarmId != farmId)
        {
            return BadRequest("House does not belong to the specified farm.");
        }

        var normalizedBatchCode = request.BatchCode.Trim();
        var duplicateExists = await _db.Flocks
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .AnyAsync(f => f.BatchCode == normalizedBatchCode);

        if (duplicateExists)
        {
            return Conflict("A flock with this BatchCode already exists.");
        }

        var flock = new Flock
        {
            TenantId = tenantId,
            FarmId = farmId,
            HouseId = request.HouseId,
            BatchCode = normalizedBatchCode,
            BirdType = NormalizeBirdType(request.BirdType),
            Breed = request.Breed.Trim(),
            ArrivalDate = DateTime.SpecifyKind(request.ArrivalDate.Date, DateTimeKind.Utc),
            InitialCount = request.InitialCount,
            Status = "active"
        };

        _db.Flocks.Add(flock);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = flock.Id }, flock);
    }

    [HttpGet("flocks/{id:guid}")]
    public async Task<ActionResult<Flock>> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var flock = await _db.Flocks
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (flock is null)
        {
            return NotFound();
        }

        return Ok(flock);
    }

    [HttpPut("flocks/{id:guid}")]
    public async Task<ActionResult<Flock>> Update(Guid id, FlockUpdateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var validation = ValidateFlockRequest(request);
        if (validation is not null)
        {
            return validation;
        }

        var flock = await _db.Flocks
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (flock is null)
        {
            return NotFound();
        }

        var house = await _db.Houses
            .AsNoTracking()
            .Where(h => h.TenantId == tenantId && !h.IsDeleted)
            .FirstOrDefaultAsync(h => h.Id == request.HouseId);

        if (house is null)
        {
            return NotFound("House not found.");
        }

        if (house.FarmId != flock.FarmId)
        {
            return BadRequest("House does not belong to the flock's farm.");
        }

        var normalizedBatchCode = request.BatchCode.Trim();
        if (!string.Equals(flock.BatchCode, normalizedBatchCode, StringComparison.Ordinal))
        {
            var duplicateExists = await _db.Flocks
                .AsNoTracking()
                .Where(f => f.TenantId == tenantId && !f.IsDeleted)
                .AnyAsync(f => f.BatchCode == normalizedBatchCode && f.Id != flock.Id);

            if (duplicateExists)
            {
                return Conflict("A flock with this BatchCode already exists.");
            }
        }

        flock.HouseId = request.HouseId;
        flock.BatchCode = normalizedBatchCode;
        flock.BirdType = NormalizeBirdType(request.BirdType);
        flock.Breed = request.Breed.Trim();
        flock.ArrivalDate = DateTime.SpecifyKind(request.ArrivalDate.Date, DateTimeKind.Utc);
        flock.InitialCount = request.InitialCount;
        flock.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(flock);
    }

    [HttpDelete("flocks/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
            return errorResult!;

        var flock = await _db.Flocks
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (flock is null)
            return NotFound();

        flock.IsDeleted = true;
        flock.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("flocks/{id:guid}/close")]
    public async Task<ActionResult<Flock>> Close(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var flock = await _db.Flocks
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (flock is null)
        {
            return NotFound();
        }

        flock.Status = "closed";
        flock.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(flock);
    }

    private ActionResult? ValidateFlockRequest(FlockRequestBase request)
    {
        if (string.IsNullOrWhiteSpace(request.BatchCode))
        {
            return BadRequest("BatchCode is required.");
        }

        if (string.IsNullOrWhiteSpace(request.BirdType))
        {
            return BadRequest("BirdType is required.");
        }

        if (!AllowedBirdTypes.Contains(request.BirdType.Trim()))
        {
            return BadRequest("BirdType must be one of: Layer, Broiler.");
        }

        if (string.IsNullOrWhiteSpace(request.Breed))
        {
            return BadRequest("Breed is required.");
        }

        if (request.ArrivalDate == default)
        {
            return BadRequest("ArrivalDate is required.");
        }

        if (request.InitialCount < 0)
        {
            return BadRequest("InitialCount must be 0 or greater.");
        }

        return null;
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

    private static string NormalizeBirdType(string value)
    {
        return value.Trim().ToLowerInvariant();
    }

    public abstract record FlockRequestBase(Guid HouseId, string BatchCode, string BirdType, string Breed, DateTime ArrivalDate, int InitialCount);

    public sealed record FlockCreateRequest(Guid HouseId, string BatchCode, string BirdType, string Breed, DateTime ArrivalDate, int InitialCount)
        : FlockRequestBase(HouseId, BatchCode, BirdType, Breed, ArrivalDate, InitialCount);

    public sealed record FlockUpdateRequest(Guid HouseId, string BatchCode, string BirdType, string Breed, DateTime ArrivalDate, int InitialCount)
        : FlockRequestBase(HouseId, BatchCode, BirdType, Breed, ArrivalDate, InitialCount);
}
