using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class WeightRecord : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? AnimalId { get; set; }
    public DateTime RecordDate { get; set; }
    public decimal WeightKg { get; set; }
    public int SampledCount { get; set; }
    public string? Notes { get; set; }
}
