using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class MilkRecord : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? AnimalId { get; set; }
    public Guid? GroupId { get; set; }
    public DateOnly RecordDate { get; set; }
    public string Session { get; set; } = "FullDay";  // Morning / Evening / FullDay
    public decimal QuantityLitres { get; set; }
    public string? Notes { get; set; }
}
