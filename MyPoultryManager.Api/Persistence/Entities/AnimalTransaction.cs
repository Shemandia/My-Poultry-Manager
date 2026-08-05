using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class AnimalTransaction : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid? AnimalId { get; set; }
    public string TransactionType { get; set; } = default!;  // Purchase / Sale
    public int HeadCount { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal? PricePerHead { get; set; }
    public DateOnly TransactionDate { get; set; }
    public string? CounterpartyName { get; set; }
    public string? Notes { get; set; }
}
