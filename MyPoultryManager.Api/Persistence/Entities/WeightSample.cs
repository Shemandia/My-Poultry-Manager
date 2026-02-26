namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class WeightSample : BaseEntity
{
    public Guid FlockId { get; set; }
    public DateOnly SampleDate { get; set; }
    public int SampleSize { get; set; }
    public decimal AvgWeightKg { get; set; }
    public decimal? TargetWeightKg { get; set; }
    public string? Notes { get; set; }
}
