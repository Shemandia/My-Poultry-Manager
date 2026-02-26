using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Authorize]
public class WeightSamplesController : ControllerBase
{
    private readonly AppDbContext _db;

    public WeightSamplesController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/flocks/{flockId}/weight-samples
    [HttpGet("api/v1/flocks/{flockId:guid}/weight-samples")]
    [Authorize(Roles = "owner,farm_manager,supervisor")]
    public async Task<IActionResult> GetAll(Guid flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flockExists = await _db.Flocks.AnyAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (!flockExists) return NotFound("Flock not found.");

        var samples = await _db.WeightSamples
            .AsNoTracking()
            .Where(w => w.TenantId == tenantId && w.FlockId == flockId)
            .OrderByDescending(w => w.SampleDate)
            .ToListAsync();

        return Ok(samples);
    }

    // POST /api/v1/flocks/{flockId}/weight-samples
    [HttpPost("api/v1/flocks/{flockId:guid}/weight-samples")]
    [Authorize(Roles = "owner,farm_manager,supervisor")]
    public async Task<IActionResult> Create(Guid flockId, WeightSampleRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var flock = await _db.Flocks.FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == flockId);
        if (flock is null) return NotFound("Flock not found.");

        if (request.SampleDate == default) return BadRequest("SampleDate is required.");
        if (request.SampleSize <= 0) return BadRequest("SampleSize must be greater than zero.");
        if (request.AvgWeightKg <= 0) return BadRequest("AvgWeightKg must be greater than zero.");

        var sample = new WeightSample
        {
            TenantId = tenantId,
            FlockId = flockId,
            SampleDate = request.SampleDate,
            SampleSize = request.SampleSize,
            AvgWeightKg = request.AvgWeightKg,
            TargetWeightKg = request.TargetWeightKg,
            Notes = request.Notes?.Trim()
        };

        _db.WeightSamples.Add(sample);
        await _db.SaveChangesAsync();

        return StatusCode(201, sample);
    }

    // PUT /api/v1/weight-samples/{id}
    [HttpPut("api/v1/weight-samples/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager,supervisor")]
    public async Task<IActionResult> Update(Guid id, WeightSampleRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var sample = await _db.WeightSamples
            .FirstOrDefaultAsync(w => w.TenantId == tenantId && w.Id == id);

        if (sample is null) return NotFound();

        if (request.SampleDate == default) return BadRequest("SampleDate is required.");
        if (request.SampleSize <= 0) return BadRequest("SampleSize must be greater than zero.");
        if (request.AvgWeightKg <= 0) return BadRequest("AvgWeightKg must be greater than zero.");

        sample.SampleDate = request.SampleDate;
        sample.SampleSize = request.SampleSize;
        sample.AvgWeightKg = request.AvgWeightKg;
        sample.TargetWeightKg = request.TargetWeightKg;
        sample.Notes = request.Notes?.Trim();
        await _db.SaveChangesAsync();

        return Ok(sample);
    }

    // DELETE /api/v1/weight-samples/{id}
    [HttpDelete("api/v1/weight-samples/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var sample = await _db.WeightSamples
            .FirstOrDefaultAsync(w => w.TenantId == tenantId && w.Id == id);

        if (sample is null) return NotFound();

        sample.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    public sealed record WeightSampleRequest(
        DateOnly SampleDate,
        int SampleSize,
        decimal AvgWeightKg,
        decimal? TargetWeightKg,
        string? Notes
    );
}
