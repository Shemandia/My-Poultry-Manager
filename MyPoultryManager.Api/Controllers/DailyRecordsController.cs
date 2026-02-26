using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class DailyRecordsController : ControllerBase
{
    private readonly AppDbContext _db;

    public DailyRecordsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("flocks/{flockId:guid}/daily-records")]
    public async Task<ActionResult<IEnumerable<DailyRecord>>> GetByFlock(
        Guid flockId,
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
        {
            return BadRequest("dateFrom must be on or before dateTo.");
        }

        var query = _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && !r.IsDeleted && r.FlockId == flockId);

        if (dateFrom.HasValue)
        {
            query = query.Where(r => r.RecordDate >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            query = query.Where(r => r.RecordDate <= dateTo.Value);
        }

        var records = await query.ToListAsync();

        return Ok(records);
    }

    [HttpPost("flocks/{flockId:guid}/daily-records")]
    public async Task<ActionResult<DailyRecord>> Create(Guid flockId, DailyRecordCreateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var validation = ValidateDailyRecordRequest(request);
        if (validation is not null)
        {
            return validation;
        }

        var flock = await _db.Flocks
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == flockId);

        if (flock is null)
        {
            return NotFound("Flock not found.");
        }

        var recordDate = request.RecordDate;

        var duplicateExists = await _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && !r.IsDeleted)
            .AnyAsync(r => r.FlockId == flockId && r.RecordDate == recordDate);

        if (duplicateExists)
        {
            return Conflict("A record already exists for this flock and date.");
        }

        var record = new DailyRecord
        {
            TenantId = tenantId,
            FlockId = flockId,
            RecordDate = recordDate,
            EggsTotal = request.EggsTotal,
            EggsBroken = request.EggsBroken,
            EggsSold = request.EggsSold,
            Mortality = request.Mortality,
            FeedConsumedKg = request.FeedConsumedKg
        };

        _db.DailyRecords.Add(record);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = record.Id }, record);
    }

    [HttpGet("daily-records/{id:guid}")]
    public async Task<ActionResult<DailyRecord>> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var record = await _db.DailyRecords
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId && !r.IsDeleted)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (record is null)
        {
            return NotFound();
        }

        return Ok(record);
    }

    [HttpPut("daily-records/{id:guid}")]
    public async Task<ActionResult<DailyRecord>> Update(Guid id, DailyRecordUpdateRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var validation = ValidateDailyRecordRequest(request);
        if (validation is not null)
        {
            return validation;
        }

        var record = await _db.DailyRecords
            .Where(r => r.TenantId == tenantId && !r.IsDeleted)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (record is null)
        {
            return NotFound();
        }

        var newDate = request.RecordDate;
        if (record.RecordDate != newDate)
        {
            var duplicateExists = await _db.DailyRecords
                .AsNoTracking()
                .Where(r => r.TenantId == tenantId && !r.IsDeleted)
                .AnyAsync(r => r.FlockId == record.FlockId && r.RecordDate == newDate);

            if (duplicateExists)
            {
                return Conflict("A record already exists for this flock and date.");
            }
        }

        record.RecordDate = newDate;
        record.EggsTotal = request.EggsTotal;
        record.EggsBroken = request.EggsBroken;
        record.EggsSold = request.EggsSold;
        record.Mortality = request.Mortality;
        record.FeedConsumedKg = request.FeedConsumedKg;
        record.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(record);
    }

    [HttpDelete("daily-records/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var errorResult))
        {
            return errorResult!;
        }

        var record = await _db.DailyRecords
            .Where(r => r.TenantId == tenantId && !r.IsDeleted)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (record is null)
        {
            return NotFound();
        }

        record.IsDeleted = true;
        record.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    private ActionResult? ValidateDailyRecordRequest(DailyRecordRequestBase request)
    {
        if (request.RecordDate == default)
        {
            return BadRequest("RecordDate is required.");
        }

        if (request.EggsTotal < 0 ||
            request.EggsBroken < 0 ||
            request.EggsSold < 0 ||
            request.FeedConsumedKg < 0 ||
            request.Mortality < 0)
        {
            return BadRequest("Values must be 0 or greater.");
        }

        if (request.EggsBroken > request.EggsTotal)
        {
            return UnprocessableEntity("EggsBroken cannot exceed EggsTotal.");
        }

        if (request.EggsSold > request.EggsTotal)
        {
            return UnprocessableEntity("EggsSold cannot exceed EggsTotal.");
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

    public abstract record DailyRecordRequestBase(
        DateOnly RecordDate,
        int EggsTotal,
        int EggsBroken,
        int EggsSold,
        int Mortality,
        decimal FeedConsumedKg);

    public sealed record DailyRecordCreateRequest(
        DateOnly RecordDate,
        int EggsTotal,
        int EggsBroken,
        int EggsSold,
        int Mortality,
        decimal FeedConsumedKg)
        : DailyRecordRequestBase(
            RecordDate,
            EggsTotal,
            EggsBroken,
            EggsSold,
            Mortality,
            FeedConsumedKg);

    public sealed record DailyRecordUpdateRequest(
        DateOnly RecordDate,
        int EggsTotal,
        int EggsBroken,
        int EggsSold,
        int Mortality,
        decimal FeedConsumedKg)
        : DailyRecordRequestBase(
            RecordDate,
            EggsTotal,
            EggsBroken,
            EggsSold,
            Mortality,
            FeedConsumedKg);
}
