using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class MatingRecord : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid DamId { get; set; }
    public Guid? SireId { get; set; }
    public string? SireTag { get; set; }
    public DateOnly MatingDate { get; set; }
    public string MatingMethod { get; set; } = "Natural";
    public string? Notes { get; set; }
}
