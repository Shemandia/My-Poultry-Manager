using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class FarmTasksController : ControllerBase
{
    private readonly AppDbContext _db;

    public FarmTasksController(AppDbContext db) => _db = db;

    // GET /api/v1/farms/{farmId}/tasks
    [HttpGet("farms/{farmId:guid}/tasks")]
    public async Task<ActionResult<IEnumerable<FarmTask>>> GetByFarm(
        Guid farmId,
        [FromQuery] string? status,
        [FromQuery] string? priority)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        var query = _db.FarmTasks
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.FarmId == farmId && !t.IsDeleted);

        if (!string.IsNullOrWhiteSpace(status))   query = query.Where(t => t.Status == status);
        if (!string.IsNullOrWhiteSpace(priority)) query = query.Where(t => t.Priority == priority);

        var tasks = await query
            .OrderBy(t => t.DueDate == null)
            .ThenBy(t => t.DueDate)
            .ThenByDescending(t => t.Priority == "High" ? 2 : t.Priority == "Medium" ? 1 : 0)
            .ToListAsync();

        return Ok(tasks);
    }

    // POST /api/v1/farms/{farmId}/tasks
    [HttpPost("farms/{farmId:guid}/tasks")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<ActionResult<FarmTask>> Create(Guid farmId, FarmTaskRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var farmExists = await _db.Farms
            .AsNoTracking()
            .AnyAsync(f => f.Id == farmId && f.TenantId == tenantId && !f.IsDeleted);
        if (!farmExists) return NotFound("Farm not found.");

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest("Title is required.");

        var validStatuses  = new HashSet<string> { "Pending", "InProgress", "Done", "Cancelled" };
        var validPriorities = new HashSet<string> { "Low", "Medium", "High" };

        var status   = string.IsNullOrWhiteSpace(request.Status)   ? "Pending" : request.Status;
        var priority = string.IsNullOrWhiteSpace(request.Priority) ? "Medium" : request.Priority;

        if (!validStatuses.Contains(status))    return BadRequest("Invalid status.");
        if (!validPriorities.Contains(priority)) return BadRequest("Invalid priority.");

        var task = new FarmTask
        {
            TenantId          = tenantId,
            FarmId            = farmId,
            Title             = request.Title.Trim(),
            Description       = request.Description?.Trim(),
            AssignedToUserId  = request.AssignedToUserId,
            DueDate           = request.DueDate,
            Status            = status,
            Priority          = priority,
            Notes             = request.Notes?.Trim(),
        };

        _db.FarmTasks.Add(task);
        await _db.SaveChangesAsync();
        return Created($"/api/v1/farms/{farmId}/tasks/{task.Id}", task);
    }

    // PATCH /api/v1/tasks/{id}/status
    [HttpPatch("tasks/{id:guid}/status")]
    [Authorize(Roles = "owner,farm_manager,supervisor,worker")]
    public async Task<ActionResult<FarmTask>> UpdateStatus(Guid id, TaskStatusRequest request)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var validStatuses = new HashSet<string> { "Pending", "InProgress", "Done", "Cancelled" };
        if (!validStatuses.Contains(request.Status))
            return BadRequest("Invalid status.");

        var task = await _db.FarmTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && !t.IsDeleted);
        if (task == null) return NotFound("Task not found.");

        task.Status = request.Status;
        await _db.SaveChangesAsync();
        return Ok(task);
    }

    // DELETE /api/v1/tasks/{id}
    [HttpDelete("tasks/{id:guid}")]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetTenantId(out var tenantId, out var err)) return err!;

        var task = await _db.FarmTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId && !t.IsDeleted);
        if (task == null) return NotFound("Task not found.");

        task.IsDeleted = true;
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

public record FarmTaskRequest(
    string Title,
    string? Description,
    DateOnly? DueDate,
    string? Status,
    string? Priority,
    Guid? AssignedToUserId,
    string? Notes);

public record TaskStatusRequest(string Status);
