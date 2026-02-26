namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class FeedItem : BaseEntity
{
    public string Name { get; set; } = default!;
    public string Unit { get; set; } = default!; // kg | bag | ton
    public decimal CurrentStockKg { get; set; } = 0;
    public decimal? LowStockThresholdKg { get; set; }
    public string? Notes { get; set; }
}
