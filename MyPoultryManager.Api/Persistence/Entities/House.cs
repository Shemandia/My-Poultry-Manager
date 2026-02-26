namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class House : BaseEntity
{
    public Guid FarmId { get; set; }
    public string Name { get; set; } = default!;
    public int Capacity { get; set; } = 0;
    public string HouseType { get; set; } = default!;
    public string? Notes { get; set; }
}
