namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class DailyRecord : BaseEntity
{
    public Guid FlockId { get; set; }
    public DateOnly RecordDate { get; set; }
    public int EggsTotal { get; set; }
    public int EggsBroken { get; set; }
    public int EggsSold { get; set; }
    public int Mortality { get; set; }
    public decimal FeedConsumedKg { get; set; }
}
