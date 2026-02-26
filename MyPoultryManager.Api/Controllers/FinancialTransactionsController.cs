using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/transactions")]
[Authorize(Roles = "owner,farm_manager,accountant")]
public class FinancialTransactionsController : ControllerBase
{
    private static readonly HashSet<string> ValidTypes =
        new(StringComparer.OrdinalIgnoreCase) { "income", "expense" };

    private static readonly HashSet<string> ValidCategories =
        new(StringComparer.OrdinalIgnoreCase)
        { "feed", "medication", "utilities", "egg_sale", "bird_sale", "labor", "other" };

    private readonly AppDbContext _db;

    public FinancialTransactionsController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/transactions?dateFrom=&dateTo=&type=&category=&farmId=&flockId=
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo,
        [FromQuery] string? type,
        [FromQuery] string? category,
        [FromQuery] Guid? farmId,
        [FromQuery] Guid? flockId)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var query = _db.FinancialTransactions
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId);

        if (dateFrom.HasValue) query = query.Where(t => t.TransactionDate >= dateFrom.Value);
        if (dateTo.HasValue)   query = query.Where(t => t.TransactionDate <= dateTo.Value);
        if (!string.IsNullOrWhiteSpace(type))     query = query.Where(t => t.Type == type.ToLowerInvariant());
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(t => t.Category == category.ToLowerInvariant());
        if (farmId.HasValue)  query = query.Where(t => t.FarmId == farmId.Value);
        if (flockId.HasValue) query = query.Where(t => t.FlockId == flockId.Value);

        var results = await query
            .OrderByDescending(t => t.TransactionDate)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync();

        return Ok(results);
    }

    // GET /api/v1/transactions/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var tx = await _db.FinancialTransactions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == id);

        return tx is null ? NotFound() : Ok(tx);
    }

    // POST /api/v1/transactions
    [HttpPost]
    public async Task<IActionResult> Create(TransactionRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        if (!ValidTypes.Contains(request.Type))
            return UnprocessableEntity("Type must be 'income' or 'expense'.");

        if (!ValidCategories.Contains(request.Category))
            return UnprocessableEntity("Category must be one of: feed, medication, utilities, egg_sale, bird_sale, labor, other.");

        if (request.Amount <= 0)
            return BadRequest("Amount must be greater than zero.");

        if (request.TransactionDate == default)
            return BadRequest("TransactionDate is required.");

        var tx = new FinancialTransaction
        {
            TenantId = tenantId,
            FarmId = request.FarmId,
            FlockId = request.FlockId,
            Type = request.Type.ToLowerInvariant(),
            Category = request.Category.ToLowerInvariant(),
            Amount = request.Amount,
            TransactionDate = request.TransactionDate,
            Notes = request.Notes?.Trim(),
            Reference = request.Reference?.Trim()
        };

        _db.FinancialTransactions.Add(tx);
        await _db.SaveChangesAsync();

        return StatusCode(201, tx);
    }

    // PUT /api/v1/transactions/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, TransactionRequest request)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        if (!ValidTypes.Contains(request.Type))
            return UnprocessableEntity("Type must be 'income' or 'expense'.");

        if (!ValidCategories.Contains(request.Category))
            return UnprocessableEntity("Category must be one of: feed, medication, utilities, egg_sale, bird_sale, labor, other.");

        if (request.Amount <= 0)
            return BadRequest("Amount must be greater than zero.");

        var tx = await _db.FinancialTransactions
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == id);

        if (tx is null) return NotFound();

        tx.FarmId = request.FarmId;
        tx.FlockId = request.FlockId;
        tx.Type = request.Type.ToLowerInvariant();
        tx.Category = request.Category.ToLowerInvariant();
        tx.Amount = request.Amount;
        tx.TransactionDate = request.TransactionDate;
        tx.Notes = request.Notes?.Trim();
        tx.Reference = request.Reference?.Trim();

        await _db.SaveChangesAsync();
        return Ok(tx);
    }

    // DELETE /api/v1/transactions/{id}
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "owner")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId)) return Unauthorized();

        var tx = await _db.FinancialTransactions
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == id);

        if (tx is null) return NotFound();

        tx.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private bool TryGetTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    public sealed record TransactionRequest(
        string Type,
        string Category,
        decimal Amount,
        DateOnly TransactionDate,
        Guid? FarmId,
        Guid? FlockId,
        string? Notes,
        string? Reference
    );
}
