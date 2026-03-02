using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class Animal : BaseEntity
{
    public Guid FarmId { get; set; }
    public Guid SpeciesId { get; set; }
    public Guid? BreedId { get; set; }
    public Guid? GroupId { get; set; }
    public string TagNumber { get; set; } = default!;
    public string? Name { get; set; }
    public string Sex { get; set; } = default!;
    public DateTime? BirthDate { get; set; }
    public string Status { get; set; } = "Alive";
    public string? Notes { get; set; }
}
