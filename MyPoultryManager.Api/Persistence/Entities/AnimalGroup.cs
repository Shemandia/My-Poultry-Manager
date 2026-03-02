using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class AnimalGroup : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid? LocationId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? BreedId { get; set; }
    public string GroupCode { get; set; } = default!;
    public string? Name { get; set; }
    public DateTime StartDate { get; set; }
    public int InitialCount { get; set; }
    public int CurrentCount { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime? ClosedDate { get; set; }
}
