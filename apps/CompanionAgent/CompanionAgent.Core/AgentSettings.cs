namespace CompanionAgent.Core;

public sealed class AgentSettings
{
    public string SupabaseUrl { get; set; } = "https://nnhbowhfqjucedjnsvtp.supabase.co";
    public string SupabaseAnonKey { get; set; } = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGJvd2hmcWp1Y2Vkam5zdnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzEwMjgsImV4cCI6MjA5NDgwNzAyOH0.83_32291NL4y4p4J8FjgpGTy2_XSO03PJ9edMgs8zy8";
    public string WebAppUrl { get; set; } = "https://sim-racing-companion.vercel.app";
    public string UserToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public int SyncIntervalMinutes { get; set; } = 5;
    public bool AutoStart { get; set; } = true;
    public DateTimeOffset? LastSyncAt { get; set; }
    public int LastSyncSessionCount { get; set; }

    // Custom data paths (empty = use default locations)
    public string CustomSessionsPath { get; set; } = "";
    public string CustomPersonalBestPath { get; set; } = "";

    // Device pairing (browser-based flow)
    public string DeviceId { get; set; } = "";
    public string DeviceSecret { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string UserId { get; set; } = "";
    public string UserEmail { get; set; } = "";
    public DateTimeOffset? PairedAt { get; set; }
}
