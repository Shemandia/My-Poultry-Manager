using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class HealthEvent : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? AnimalId { get; set; }
    public DateTime EventDate { get; set; }
    public string EventType { get; set; } = default!;
    public string? Diagnosis { get; set; }
    public string? Medication { get; set; }
    public string? Dose { get; set; }
    public DateTime? NextDueDate { get; set; }
    public string? Notes { get; set; }
}
