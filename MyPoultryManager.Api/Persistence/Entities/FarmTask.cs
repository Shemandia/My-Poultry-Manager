using MyPoultryManager.Api.Persistence.Common;

namespace MyPoultryManager.Api.Persistence.Entities;

public class FarmTask : BaseEntity
{
    public Guid FarmId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public DateOnly? DueDate { get; set; }
    public string Status { get; set; } = "Pending";   // Pending / InProgress / Done / Cancelled
    public string Priority { get; set; } = "Medium";  // Low / Medium / High
    public string? Notes { get; set; }
}
