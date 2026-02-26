namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class Farm : BaseEntity
{
    public string Name { get; set; } = default!;
    public string? Location { get; set; }
    public int? Capacity { get; set; }
}
