namespace MyPoultryManager.Api.Persistence.Common;

public abstract class BaseEntity : AuditableEntity
{
    public Guid TenantId { get; set; }
}
