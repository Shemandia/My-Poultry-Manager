namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class HealthLog : BaseEntity
{
    public Guid FlockId { get; set; }
    public DateOnly LogDate { get; set; }
    public string? Symptoms { get; set; }
    public string? Diagnosis { get; set; }
    public string? Treatment { get; set; }
    public string? Medication { get; set; }
    public decimal? DosageMl { get; set; }
    public string? VetName { get; set; }
    public DateOnly? FollowUpDate { get; set; }
    public string? Notes { get; set; }
}
