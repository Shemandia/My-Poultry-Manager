using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class Breed : BaseEntity
{
    public Guid SpeciesId { get; set; }
    public string Name { get; set; } = default!;
}
