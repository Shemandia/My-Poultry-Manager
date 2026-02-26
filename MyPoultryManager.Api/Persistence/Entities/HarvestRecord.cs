namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class HarvestRecord : BaseEntity
{
    public Guid FlockId { get; set; }
    public DateOnly HarvestDate { get; set; }
    public int BirdsHarvested { get; set; }
    public decimal? AvgWeightKg { get; set; }
    public decimal? TotalWeightKg { get; set; }
    public string? BuyerName { get; set; }
    public decimal? PricePerKg { get; set; }
    public string? Notes { get; set; }
}
