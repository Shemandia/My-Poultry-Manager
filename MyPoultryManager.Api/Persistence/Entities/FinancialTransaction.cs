namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class FinancialTransaction : BaseEntity
{
    public Guid? FarmId { get; set; }
    public Guid? FlockId { get; set; }
    public string Type { get; set; } = string.Empty;       // income | expense
    public string Category { get; set; } = string.Empty;   // feed | medication | utilities | egg_sale | bird_sale | labor | other
    public decimal Amount { get; set; }
    public DateOnly TransactionDate { get; set; }
    public string? Notes { get; set; }
    public string? Reference { get; set; }
}
