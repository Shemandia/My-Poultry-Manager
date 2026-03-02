using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class MovementEvent : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? AnimalId { get; set; }
    public Guid? FromLocationId { get; set; }
    public Guid? ToLocationId { get; set; }
    public DateTime MoveDate { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
}
