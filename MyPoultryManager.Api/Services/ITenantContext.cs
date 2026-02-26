namespace MyPoultryManager.Api.Services;

public interface ITenantContext
{
    Guid TenantId { get; }
    Guid? UserId { get; }
}
