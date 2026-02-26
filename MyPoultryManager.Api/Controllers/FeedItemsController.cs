using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/feed-items")]
[Authorize]
public class FeedItemsController : ControllerBase
{
    private static readonly HashSet<string> AllowedUnits = new(StringComparer.OrdinalIgnoreCase)
    {
        "kg", "bag", "ton"
    };

    private static readonly HashSet<string> AllowedMovementTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "purchase", "usage", "adjustment"
    };

    private readonly AppDbContext _db;

    public FeedItemsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/feed-items
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetTenantId(out var tenantId, out var error)) return error!;

        var items = await _db.FeedItems
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .ToListAsync();

        return Ok(items);
    }

    // GET /api/v1/feed-items/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var error)) return error!;

        var item = await _db.FeedItems
            .AsNoTracking()
            .Where(f => f.TenantId == tenantId && !f.IsDeleted)
            .FirstOrDefaultAsync(f => f.Id == id);

        if (item is null) return NotFound();

        return Ok(item);
    }

    // POST /api/v1/feed-items
    [HttpPost]
    public async Task<IActionResult> Create(FeedItemRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var error)) return error!;

        var validation = ValidateFeedItemRequest(request);
        if (validation is not null) return validation;

        var duplicate = await _db.FeedItems
            .AnyAsync(f => f.TenantId == tenantId && f.Name == request.Name.Trim() && !f.IsDeleted);

        if (duplicate)
            return Conflict("A feed item with that name already exists.");

        var item = new FeedItem
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            Unit = request.Unit.Trim().ToLowerInvariant(),
            CurrentStockKg = request.CurrentStockKg ?? 0,
            LowStockThresholdKg = request.LowStockThresholdKg,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim()
        };

        _db.FeedItems.Add(item);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    // PUT /api/v1/feed-items/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, FeedItemRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var error)) return error!;

        var validation = ValidateFeedItemRequest(request);
        if (validation is not null) return validation;

        var item = await _db.FeedItems
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == id && !f.IsDeleted);

        if (item is null) return NotFound();

        var nameChanged = !string.Equals(item.Name, request.Name.Trim(), StringComparison.Ordinal);
        if (nameChanged)
        {
            var duplicate = await _db.FeedItems
                .AnyAsync(f => f.TenantId == tenantId && f.Name == request.Name.Trim() && f.Id != id && !f.IsDeleted);

            if (duplicate)
                return Conflict("A feed item with that name already exists.");
        }

        item.Name = request.Name.Trim();
        item.Unit = request.Unit.Trim().ToLowerInvariant();
        item.LowStockThresholdKg = request.LowStockThresholdKg;
        item.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        await _db.SaveChangesAsync();

        return Ok(item);
    }

    // DELETE /api/v1/feed-items/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var error)) return error!;

        var item = await _db.FeedItems
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == id && !f.IsDeleted);

        if (item is null) return NotFound();

        item.IsDeleted = true;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    // GET /api/v1/feed-items/{id}/movements
    [HttpGet("{id:guid}/movements")]
    public async Task<IActionResult> GetMovements(
        Guid id,
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out var tenantId, out var error)) return error!;

        var exists = await _db.FeedItems
            .AsNoTracking()
            .AnyAsync(f => f.TenantId == tenantId && f.Id == id && !f.IsDeleted);

        if (!exists) return NotFound();

        if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
            return BadRequest("dateFrom must be on or before dateTo.");

        var query = _db.FeedStockMovements
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.FeedItemId == id && !m.IsDeleted);

        if (dateFrom.HasValue)
            query = query.Where(m => m.MovementDate >= dateFrom.Value);

        if (dateTo.HasValue)
            query = query.Where(m => m.MovementDate <= dateTo.Value);

        var movements = await query
            .OrderByDescending(m => m.MovementDate)
            .ToListAsync();

        return Ok(movements);
    }

    // POST /api/v1/feed-items/{id}/movements
    [HttpPost("{id:guid}/movements")]
    public async Task<IActionResult> AddMovement(Guid id, MovementRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var error)) return error!;

        var item = await _db.FeedItems
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.Id == id && !f.IsDeleted);

        if (item is null) return NotFound();

        if (string.IsNullOrWhiteSpace(request.MovementType) || !AllowedMovementTypes.Contains(request.MovementType))
            return UnprocessableEntity("MovementType must be one of: purchase, usage, adjustment.");

        if (request.MovementDate == default)
            return BadRequest("MovementDate is required.");

        var type = request.MovementType.Trim().ToLowerInvariant();

        // Validate quantity and compute new stock
        decimal newStock;
        switch (type)
        {
            case "purchase":
                if (request.QuantityKg <= 0)
                    return BadRequest("QuantityKg must be greater than 0 for a purchase.");
                newStock = item.CurrentStockKg + request.QuantityKg;
                break;

            case "usage":
                if (request.QuantityKg <= 0)
                    return BadRequest("QuantityKg must be greater than 0 for usage.");
                if (request.QuantityKg > item.CurrentStockKg)
                    return UnprocessableEntity($"Insufficient stock. Available: {item.CurrentStockKg} kg, requested: {request.QuantityKg} kg.");
                newStock = item.CurrentStockKg - request.QuantityKg;
                break;

            case "adjustment":
                // QuantityKg is the correction delta (positive = add, negative = subtract)
                newStock = item.CurrentStockKg + request.QuantityKg;
                if (newStock < 0)
                    return UnprocessableEntity($"Adjustment would result in negative stock ({newStock} kg).");
                break;

            default:
                return UnprocessableEntity("Invalid MovementType.");
        }

        // Validate optional FlockId
        if (request.FlockId.HasValue)
        {
            var flockExists = await _db.Flocks
                .AsNoTracking()
                .AnyAsync(f => f.TenantId == tenantId && f.Id == request.FlockId.Value && !f.IsDeleted);

            if (!flockExists)
                return NotFound("Flock not found.");
        }

        var movement = new FeedStockMovement
        {
            TenantId = tenantId,
            FeedItemId = id,
            FlockId = request.FlockId,
            MovementType = type,
            QuantityKg = request.QuantityKg,
            MovementDate = request.MovementDate,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim()
        };

        item.CurrentStockKg = newStock;

        _db.FeedStockMovements.Add(movement);
        await _db.SaveChangesAsync();

        return StatusCode(201, new
        {
            movement,
            feedItem = new { item.Id, item.Name, item.CurrentStockKg, item.Unit, IsLowStock = IsLowStock(item) }
        });
    }

    private static bool IsLowStock(FeedItem item) =>
        item.LowStockThresholdKg.HasValue && item.CurrentStockKg <= item.LowStockThresholdKg.Value;

    private ActionResult? ValidateFeedItemRequest(FeedItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");

        if (request.Name.Trim().Length > 150)
            return UnprocessableEntity("Name must not exceed 150 characters.");

        if (string.IsNullOrWhiteSpace(request.Unit) || !AllowedUnits.Contains(request.Unit.Trim()))
            return UnprocessableEntity("Unit must be one of: kg, bag, ton.");

        if (request.CurrentStockKg.HasValue && request.CurrentStockKg.Value < 0)
            return BadRequest("CurrentStockKg must be 0 or greater.");

        if (request.LowStockThresholdKg.HasValue && request.LowStockThresholdKg.Value < 0)
            return BadRequest("LowStockThresholdKg must be 0 or greater.");

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

    public sealed record FeedItemRequest(
        string Name,
        string Unit,
        decimal? CurrentStockKg,
        decimal? LowStockThresholdKg,
        string? Notes);

    public sealed record MovementRequest(
        string MovementType,
        decimal QuantityKg,
        DateOnly MovementDate,
        Guid? FlockId,
        string? Notes,
        string? Reference);
}
