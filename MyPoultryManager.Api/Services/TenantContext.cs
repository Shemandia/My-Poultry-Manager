using System.Security.Claims;

namespace MyPoultryManager.Api.Services;

public class TenantContext : ITenantContext
{
    private readonly IHttpContextAccessor _http;

    public TenantContext(IHttpContextAccessor http)
    {
        _http = http;
    }

    public Guid TenantId
    {
        get
        {
            // Priority 1: JWT claim (set after authentication)
            var claim = _http.HttpContext?.User.FindFirst("tenantId")?.Value;
            if (Guid.TryParse(claim, out var fromClaim))
                return fromClaim;

            // Priority 2: X-Tenant-Id header (fallback for unauthenticated/legacy calls)
            var header = _http.HttpContext?.Request.Headers["X-Tenant-Id"].FirstOrDefault();
            return Guid.TryParse(header, out var fromHeader) ? fromHeader : Guid.Empty;
        }
    }

    public Guid? UserId
    {
        get
        {
            var claim = _http.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? _http.HttpContext?.User.FindFirst("sub")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }
}
