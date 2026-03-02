using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class Species : BaseEntity
{
    public string Name { get; set; } = default!;
    public string Code { get; set; } = default!;
    public bool TracksIndividuals { get; set; }
    public bool IsDairy { get; set; }
    public bool IsEggLayer { get; set; }
    public bool IsWool { get; set; }
}
