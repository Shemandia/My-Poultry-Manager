namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class VaccinationSchedule : BaseEntity
{
    public Guid FlockId { get; set; }
    public string VaccineName { get; set; } = string.Empty;
    public DateOnly ScheduledDate { get; set; }
    public DateOnly? GivenDate { get; set; }
    public string? Notes { get; set; }
}
