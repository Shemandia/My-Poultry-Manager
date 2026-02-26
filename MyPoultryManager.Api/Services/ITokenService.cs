using MyPoultryManager.Api.Persistence.Entities;

namespace MyPoultryManager.Api.Services;

public interface ITokenService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
}
