using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class Location : BaseEntity
{
    public Guid FarmId { get; set; }
    public string Name { get; set; } = default!;
    public string LocationType { get; set; } = default!;
    public int Capacity { get; set; }
    public string? Notes { get; set; }
}
