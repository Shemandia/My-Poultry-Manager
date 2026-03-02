using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class FeedEvent : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? AnimalId { get; set; }
    public DateTime EventDate { get; set; }
    public string FeedName { get; set; } = default!;
    public decimal QuantityKg { get; set; }
    public decimal Cost { get; set; }
    public string? Notes { get; set; }
}
