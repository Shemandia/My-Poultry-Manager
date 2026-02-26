namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class Flock : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid HouseId { get; set; }
    public string BatchCode { get; set; } = default!;
    public string BirdType { get; set; } = default!;
    public string Breed { get; set; } = default!;
    public DateTime ArrivalDate { get; set; }
    public int InitialCount { get; set; }
    public string Status { get; set; } = "active";
}
