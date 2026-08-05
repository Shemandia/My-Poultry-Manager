using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class BirthRecord : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid DamId { get; set; }
    public Guid? SireId { get; set; }
    public string? SireTag { get; set; }
    public Guid? PregnancyRecordId { get; set; }
    public DateOnly BirthDate { get; set; }
    public int TotalBorn { get; set; }
    public int LiveBorn { get; set; }
    public int Stillborn { get; set; }
    public string BirthType { get; set; } = "Single";
    public string? Complications { get; set; }
    public string? Notes { get; set; }
}
