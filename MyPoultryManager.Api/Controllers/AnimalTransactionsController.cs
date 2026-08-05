using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class AnimalTransactionsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnimalTransactionsController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/animal-transactions
    [HttpGet("farms/{farmId:guid}/animal-transactions")]
    public async Task<ActionResult<IEnumerable<AnimalTransaction>>> GetByFarm(
        Guid farmId,
        [FromQuery] string? type,
        [FromQuery] Guid? speciesId,
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var query = _db.AnimalTransactions
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.FarmId == farmId && !t.IsDeleted);

        if (!string.IsNullOrWhiteSpace(type))  query = query.Where(t => t.TransactionType == type);
        if (speciesId.HasValue)                query = query.Where(t => t.SpeciesId == speciesId.Value);
        if (dateFrom.HasValue)                 query = query.Where(t => t.TransactionDate >= dateFrom.Value);
        if (dateTo.HasValue)                   query = query.Where(t => t.TransactionDate <= dateTo.Value);

        var records = await query.OrderByDescending(t => t.TransactionDate).ToListAsync();
        return Ok(records);
    }

    // POST /api/v1/farms/{farmId}/animal-transactions
    [HttpPost("farms/{farmId:guid}/animal-transactions")]
    [Authorize(Roles = "owner,farm_manager,accountant")]
    public async Task<ActionResult<AnimalTransaction>> Create(Guid farmId, AnimalTransactionRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var validTypes = new HashSet<string> { "Purchase", "Sale" };
        if (!validTypes.Contains(request.TransactionType))
            return BadRequest("TransactionType must be Purchase or Sale.");

        if (request.HeadCount < 1) return BadRequest("HeadCount must be at least 1.");
        if (request.TotalPrice < 0) return BadRequest("TotalPrice cannot be negative.");

        var speciesExists = await _db.Species
            .AsNoTracking()
            .AnyAsync(s => s.Id == request.SpeciesId && s.TenantId == tenantId && !s.IsDeleted);
        if (!speciesExists) return NotFound("Species not found.");

        if (request.AnimalId.HasValue)
        {
            var animalExists = await _db.Animals
                .AsNoTracking()
                .AnyAsync(a => a.Id == request.AnimalId && a.TenantId == tenantId && !a.IsDeleted);
            if (!animalExists) return NotFound("Animal not found.");
        }

        var tx = new AnimalTransaction
        {
            TenantId         = tenantId,
            FarmId           = farmId,
            SpeciesId        = request.SpeciesId,
            GroupId          = request.GroupId,
            AnimalId         = request.AnimalId,
            TransactionType  = request.TransactionType,
            HeadCount        = request.HeadCount,
            TotalPrice       = request.TotalPrice,
            PricePerHead     = request.HeadCount > 0 ? Math.Round(request.TotalPrice / request.HeadCount, 2) : null,
            TransactionDate  = request.TransactionDate,
            CounterpartyName = request.CounterpartyName?.Trim(),
            Notes            = request.Notes?.Trim(),
        };

        _db.AnimalTransactions.Add(tx);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/animal-transactions/{tx.Id}", tx);
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

public record AnimalTransactionRequest(
    Guid SpeciesId,
    string TransactionType,
    int HeadCount,
    decimal TotalPrice,
    DateOnly TransactionDate,
    Guid? GroupId,
    Guid? AnimalId,
    string? CounterpartyName,
    string? Notes);
