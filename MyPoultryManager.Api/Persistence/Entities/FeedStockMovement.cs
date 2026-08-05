namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class FeedStockMovement : BaseEntity
{
    public Guid FeedItemId { get; set; }
    public Guid? FlockId { get; set; }
    public string MovementType { get; set; } = default!; // purchase | usage | adjustment
    public decimal QuantityKg { get; set; }
    public DateOnly MovementDate { get; set; }
    public string? Notes { get; set; }
    public string? Reference { get; set; }
    public string? SupplierName { get; set; }
    public decimal? PricePerKg { get; set; }
    public decimal? TotalCost { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? BatchNumber { get; set; }
}
