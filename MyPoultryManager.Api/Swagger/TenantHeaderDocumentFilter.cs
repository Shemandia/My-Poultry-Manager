using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace MyPoultryManager.Api.Swagger;

public sealed class TenantHeaderDocumentFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        if (swaggerDoc.Paths is null)
        {
            return;
        }

        foreach (var path in swaggerDoc.Paths.Values)
        {
            if (path.Operations is null)
            {
                continue;
            }

            foreach (var op in path.Operations.Values)
            {
                op.Parameters ??= new List<IOpenApiParameter>();

                if (op.Parameters.Any(p => p.Name == "X-Tenant-Id"))
                    continue;

                op.Parameters.Add(new OpenApiParameter
                {
                    Name = "X-Tenant-Id",
                    In = ParameterLocation.Header,
                    Required = true,
                    Description = "Tenant Identifier (GUID)",
                    Schema = new OpenApiSchema
                    {
                        Type = JsonSchemaType.String,
                        Format = "uuid"
                    }
                });
            }
        }
    }
}
