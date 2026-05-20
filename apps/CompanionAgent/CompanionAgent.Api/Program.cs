using System.Reflection;
using Companion.Infrastructure.History;
using Companion.SharedContracts.Agent;

const string localApiBaseUrl = "http://127.0.0.1:47832";
const string frontendCorsPolicy = "frontend-local-dev";

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls(localApiBaseUrl);
builder.Services.AddSingleton<ILocalHistoryService, LocalHistoryService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy(frontendCorsPolicy, policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors(frontendCorsPolicy);

app.MapGet("/", () => Results.Json(new
{
    name = "Sim Racing Companion Agent",
    api = localApiBaseUrl,
    health = "/api/health"
}));

app.MapGet("/api/health", () => new AgentHealthResponse(
    Status: "ok",
    Agent: "CompanionAgent.Api",
    Version: Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0",
    ServerTime: DateTimeOffset.UtcNow,
    LocalApiBaseUrl: localApiBaseUrl));

app.MapGet("/api/agent/status", () => new
{
    status = "running",
    localApiBaseUrl,
    features = new[]
    {
        "history-import",
        "profile-summary"
    }
});

app.MapGet("/api/history", (ILocalHistoryService historyService) =>
    historyService.GetHistory());

app.MapGet("/api/profile/summary", (ILocalHistoryService historyService) =>
    historyService.GetHistory().Summary);

app.MapGet("/api/sessions", (ILocalHistoryService historyService) =>
    historyService.GetHistory().Sessions);

app.MapGet("/api/personal-bests", (ILocalHistoryService historyService) =>
    historyService.GetHistory().PersonalBests);

app.Run();
