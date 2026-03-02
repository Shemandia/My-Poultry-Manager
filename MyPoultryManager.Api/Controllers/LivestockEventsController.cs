using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class LivestockEventsController : ControllerBase
{
    private readonly AppDbContext _db;

    private static readonly HashSet<string> ValidHealthEventTypes =
        new(StringComparer.OrdinalIgnoreCase)
        { "Vaccination", "Treatment", "Illness", "Checkup", "Deworming", "Other" };

    public LivestockEventsController(AppDbContext db) => _db = db;

    // POST /api/v1/farms/{farmId}/health-events
    [HttpPost("farms/{farmId:guid}/health-events")]
    public async Task<ActionResult<HealthEvent>> CreateHealthEvent(
        Guid farmId, HealthEventRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.EventType))
            return BadRequest("EventType is required.");
        if (!ValidHealthEventTypes.Contains(request.EventType))
            return BadRequest($"EventType must be one of: {string.Join(", ", ValidHealthEventTypes)}.");

        if (!await FarmAndSpeciesExist(tenantId, farmId, request.SpeciesId))
            return NotFound("Farm or Species not found.");

        var ev = new HealthEvent
        {
            TenantId    = tenantId,
            FarmId      = farmId,
            SpeciesId   = request.SpeciesId,
            GroupId     = request.GroupId,
            AnimalId    = request.AnimalId,
            EventDate   = request.EventDate.ToUniversalTime(),
            EventType   = request.EventType.Trim(),
            Diagnosis   = request.Diagnosis?.Trim(),
            Medication  = request.Medication?.Trim(),
            Dose        = request.Dose?.Trim(),
            NextDueDate = request.NextDueDate.HasValue ? request.NextDueDate.Value.ToUniversalTime() : null,
            Notes       = request.Notes?.Trim(),
        };

        _db.HealthEvents.Add(ev);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/health-events/{ev.Id}", ev);
    }

    // POST /api/v1/farms/{farmId}/weight-records
    [HttpPost("farms/{farmId:guid}/weight-records")]
    public async Task<ActionResult<WeightRecord>> CreateWeightRecord(
        Guid farmId, WeightRecordRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (request.WeightKg <= 0)
            return BadRequest("WeightKg must be positive.");
        if (request.SampledCount < 1)
            return BadRequest("SampledCount must be at least 1.");

        if (!await FarmAndSpeciesExist(tenantId, farmId, request.SpeciesId))
            return NotFound("Farm or Species not found.");

        var record = new WeightRecord
        {
            TenantId     = tenantId,
            FarmId       = farmId,
            SpeciesId    = request.SpeciesId,
            GroupId      = request.GroupId,
            AnimalId     = request.AnimalId,
            RecordDate   = request.RecordDate.ToUniversalTime(),
            WeightKg     = request.WeightKg,
            SampledCount = request.SampledCount,
            Notes        = request.Notes?.Trim(),
        };

        _db.WeightRecords.Add(record);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/weight-records/{record.Id}", record);
    }

    // POST /api/v1/farms/{farmId}/movements
    [HttpPost("farms/{farmId:guid}/movements")]
    public async Task<ActionResult<MovementEvent>> CreateMovement(
        Guid farmId, LivestockMovementRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (!await FarmAndSpeciesExist(tenantId, farmId, request.SpeciesId))
            return NotFound("Farm or Species not found.");

        var mv = new MovementEvent
        {
            TenantId       = tenantId,
            FarmId         = farmId,
            SpeciesId      = request.SpeciesId,
            GroupId        = request.GroupId,
            AnimalId       = request.AnimalId,
            FromLocationId = request.FromLocationId,
            ToLocationId   = request.ToLocationId,
            MoveDate       = request.MoveDate.ToUniversalTime(),
            Reason         = request.Reason?.Trim(),
            Notes          = request.Notes?.Trim(),
        };

        _db.MovementEvents.Add(mv);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/movements/{mv.Id}", mv);
    }

    // POST /api/v1/farms/{farmId}/feed-events
    [HttpPost("farms/{farmId:guid}/feed-events")]
    public async Task<ActionResult<FeedEvent>> CreateFeedEvent(
        Guid farmId, FeedEventRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        if (string.IsNullOrWhiteSpace(request.FeedName))
            return BadRequest("FeedName is required.");
        if (request.QuantityKg <= 0)
            return BadRequest("QuantityKg must be positive.");
        if (request.Cost < 0)
            return BadRequest("Cost cannot be negative.");

        if (!await FarmAndSpeciesExist(tenantId, farmId, request.SpeciesId))
            return NotFound("Farm or Species not found.");

        var ev = new FeedEvent
        {
            TenantId   = tenantId,
            FarmId     = farmId,
            SpeciesId  = request.SpeciesId,
            GroupId    = request.GroupId,
            AnimalId   = request.AnimalId,
            EventDate  = request.EventDate.ToUniversalTime(),
            FeedName   = request.FeedName.Trim(),
            QuantityKg = request.QuantityKg,
            Cost       = request.Cost,
            Notes      = request.Notes?.Trim(),
        };

        _db.FeedEvents.Add(ev);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/feed-events/{ev.Id}", ev);
    }

    private async Task<bool> FarmAndSpeciesExist(Guid tenantId, Guid farmId, Guid speciesId)
    {
        var farmOk = await _db.Farms.AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmOk) return false;

        var speciesOk = await _db.Species.AsNoTracking()
            .AnyAsync(s => s.Id == speciesId && s.TenantId == tenantId && !s.IsDeleted);
        return speciesOk;
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

public record HealthEventRequest(
    Guid SpeciesId,
    DateTime EventDate,
    string EventType,
    Guid? GroupId,
    Guid? AnimalId,
    string? Diagnosis,
    string? Medication,
    string? Dose,
    DateTime? NextDueDate,
    string? Notes);

public record WeightRecordRequest(
    Guid SpeciesId,
    DateTime RecordDate,
    decimal WeightKg,
    int SampledCount,
    Guid? GroupId,
    Guid? AnimalId,
    string? Notes);

public record LivestockMovementRequest(
    Guid SpeciesId,
    DateTime MoveDate,
    Guid? GroupId,
    Guid? AnimalId,
    Guid? FromLocationId,
    Guid? ToLocationId,
    string? Reason,
    string? Notes);

public record FeedEventRequest(
    Guid SpeciesId,
    DateTime EventDate,
    string FeedName,
    decimal QuantityKg,
    decimal Cost,
    Guid? GroupId,
    Guid? AnimalId,
    string? Notes);
