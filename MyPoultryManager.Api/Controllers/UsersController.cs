using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "owner", "farm_manager", "supervisor", "worker", "vet", "accountant"
    };

    private readonly AppDbContext _db;

    public UsersController(AppDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/users
    [HttpGet]
    [Authorize(Roles = "owner,farm_manager")]
    public async Task<IActionResult> GetAll()
    {
        if (!TryGetCallerTenantId(out var tenantId))
            return Unauthorized();

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && !u.IsDeleted)
            .Select(u => new { u.Id, u.Email, u.FullName, u.Role, u.IsActive, u.CreatedAt })
            .ToListAsync();

        return Ok(users);
    }

    // GET /api/v1/users/{id}
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "owner")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!TryGetCallerTenantId(out var tenantId))
            return Unauthorized();

        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.Id == id && !u.IsDeleted)
            .Select(u => new { u.Id, u.Email, u.FullName, u.Role, u.IsActive, u.CreatedAt })
            .FirstOrDefaultAsync();

        if (user is null)
            return NotFound();

        return Ok(user);
    }

    // POST /api/v1/users  — create / invite user
    [HttpPost]
    [Authorize(Roles = "owner")]
    public async Task<IActionResult> Create(UserCreateRequest request)
    {
        if (!TryGetCallerTenantId(out var tenantId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return BadRequest("A valid email is required.");

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            return BadRequest("Password must be at least 8 characters.");

        if (string.IsNullOrWhiteSpace(request.Role) || !AllowedRoles.Contains(request.Role))
            return UnprocessableEntity("Role must be one of: owner, farm_manager, supervisor, worker, vet, accountant.");

        if (request.Role.ToLowerInvariant() == "owner")
            return UnprocessableEntity("Cannot create another owner. There can only be one owner per tenant.");

        var emailExists = await _db.Users
            .AnyAsync(u => u.TenantId == tenantId && u.Email == request.Email.Trim().ToLowerInvariant());

        if (emailExists)
            return Conflict("A user with that email already exists in this tenant.");

        var user = new User
        {
            TenantId = tenantId,
            Email = request.Email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12),
            FullName = request.FullName?.Trim(),
            Role = request.Role.Trim().ToLowerInvariant(),
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return StatusCode(201, new { user.Id, user.Email, user.FullName, user.Role });
    }

    // PUT /api/v1/users/{id}/role
    [HttpPut("{id:guid}/role")]
    [Authorize(Roles = "owner")]
    public async Task<IActionResult> UpdateRole(Guid id, UserRoleRequest request)
    {
        if (!TryGetCallerTenantId(out var tenantId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Role) || !AllowedRoles.Contains(request.Role))
            return UnprocessableEntity("Role must be one of: owner, farm_manager, supervisor, worker, vet, accountant.");

        if (request.Role.ToLowerInvariant() == "owner")
            return UnprocessableEntity("Cannot promote a user to owner.");

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == id && !u.IsDeleted);

        if (user is null)
            return NotFound();

        user.Role = request.Role.Trim().ToLowerInvariant();
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.Email, user.FullName, user.Role });
    }

    // DELETE /api/v1/users/{id}  — soft deactivate
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "owner")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!TryGetCallerTenantId(out var tenantId))
            return Unauthorized();

        var callerId = GetCallerId();
        if (callerId == id)
            return BadRequest("You cannot deactivate your own account.");

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == id && !u.IsDeleted);

        if (user is null)
            return NotFound();

        user.IsDeleted = true;
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    private bool TryGetCallerTenantId(out Guid tenantId)
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(claim, out tenantId);
    }

    private Guid GetCallerId()
    {
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    public sealed record UserCreateRequest(string Email, string Password, string Role, string? FullName);
    public sealed record UserRoleRequest(string Role);
}
