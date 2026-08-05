using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class PregnancyRecord : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid DamId { get; set; }
    public Guid? MatingRecordId { get; set; }
    public DateOnly? ConfirmedDate { get; set; }
    public DateOnly ExpectedDueDate { get; set; }
    public DateOnly? ActualBirthDate { get; set; }
    public string Status { get; set; } = "Suspected";
    public string? Notes { get; set; }
}
