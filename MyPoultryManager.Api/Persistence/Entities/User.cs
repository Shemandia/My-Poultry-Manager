namespace MyPoultryManager.Api.Persistence.Entities;

using MyPoultryManager.Api.Persistence.Common;

public class User : BaseEntity
{
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public string? FullName { get; set; }
    public string Role { get; set; } = default!;
    public bool IsActive { get; set; } = true;
}
