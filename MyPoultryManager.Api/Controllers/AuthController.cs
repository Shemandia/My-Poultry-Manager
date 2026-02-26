using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPoultryManager.Api.Persistence;
using MyPoultryManager.Api.Persistence.Entities;
using MyPoultryManager.Api.Services;

namespace MyPoultryManager.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITokenService _tokens;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, ITokenService tokens, IConfiguration config)
    {
        _db = db;
        _tokens = tokens;
        _config = config;
    }

    // POST /api/v1/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CompanyName))
            return BadRequest("CompanyName is required.");

        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return BadRequest("A valid email is required.");

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            return BadRequest("Password must be at least 8 characters.");

        var tenantExists = await _db.Tenants
            .IgnoreQueryFilters()
            .AnyAsync(t => t.Name == request.CompanyName.Trim() && !t.IsDeleted);

        if (tenantExists)
            return Conflict("A company with that name already exists.");

        var tenant = new Tenant
        {
            Name = request.CompanyName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            IsActive = true
        };

        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync();

        var user = new User
        {
            TenantId = tenant.Id,
            Email = request.Email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12),
            FullName = request.OwnerName?.Trim(),
            Role = "owner",
            IsActive = true
        };

        _db.Users.Add(user);

        var refreshTokenExpiry = int.Parse(_config["Jwt:RefreshTokenExpiryDays"]!);
        var refreshToken = new RefreshToken
        {
            TenantId = tenant.Id,
            UserId = user.Id,
            Token = _tokens.GenerateRefreshToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpiry)
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync();

        var accessToken = _tokens.GenerateAccessToken(user);

        return StatusCode(201, new
        {
            tenantId = tenant.Id,
            user = new { user.Id, user.Email, user.FullName, user.Role },
            accessToken,
            refreshToken = refreshToken.Token
        });
    }

    // POST /api/v1/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Email and password are required.");

        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u =>
                u.Email == request.Email.Trim().ToLowerInvariant() &&
                !u.IsDeleted);

        if (user is null || !user.IsActive)
            return Unauthorized("Invalid credentials.");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Invalid credentials.");

        // Revoke all existing refresh tokens for this user
        var existingTokens = await _db.RefreshTokens
            .IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id && !r.IsRevoked && !r.IsDeleted)
            .ToListAsync();

        foreach (var t in existingTokens)
            t.IsRevoked = true;

        var refreshTokenExpiry = int.Parse(_config["Jwt:RefreshTokenExpiryDays"]!);
        var refreshToken = new RefreshToken
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            Token = _tokens.GenerateRefreshToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpiry)
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync();

        var accessToken = _tokens.GenerateAccessToken(user);

        return Ok(new
        {
            tenantId = user.TenantId,
            user = new { user.Id, user.Email, user.FullName, user.Role },
            accessToken,
            refreshToken = refreshToken.Token
        });
    }

    // POST /api/v1/auth/refresh
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest("RefreshToken is required.");

        var stored = await _db.RefreshTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken && !r.IsDeleted);

        if (stored is null || stored.IsRevoked || stored.ExpiresAt <= DateTime.UtcNow)
            return Unauthorized("Refresh token is invalid or expired.");

        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == stored.UserId && u.IsActive && !u.IsDeleted);

        if (user is null)
            return Unauthorized("User not found.");

        // Rotate: revoke old, issue new
        stored.IsRevoked = true;

        var refreshTokenExpiry = int.Parse(_config["Jwt:RefreshTokenExpiryDays"]!);
        var newRefreshToken = new RefreshToken
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            Token = _tokens.GenerateRefreshToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpiry)
        };

        _db.RefreshTokens.Add(newRefreshToken);
        await _db.SaveChangesAsync();

        var accessToken = _tokens.GenerateAccessToken(user);

        return Ok(new
        {
            accessToken,
            refreshToken = newRefreshToken.Token
        });
    }

    // POST /api/v1/auth/logout
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest("RefreshToken is required.");

        var stored = await _db.RefreshTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken && !r.IsDeleted);

        if (stored is not null && !stored.IsRevoked)
        {
            stored.IsRevoked = true;
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    public sealed record RegisterRequest(string CompanyName, string? OwnerName, string Email, string Password);
    public sealed record LoginRequest(string Email, string Password);
    public sealed record RefreshRequest(string RefreshToken);
}
