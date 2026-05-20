using Thomsen.AccTools.SharedMemory;
using Thomsen.AccTools.SharedMemory.Models;

if (args.Any(arg => arg.Equals("history", StringComparison.OrdinalIgnoreCase) ||
    arg.Equals("--history", StringComparison.OrdinalIgnoreCase)))
{
    HistoryConsole.Print();
    return;
}

var cancellation = new CancellationTokenSource();
var snapshotLock = new object();

StaticInfo? staticInfo = null;
Physics? physics = null;
Graphics? graphics = null;

using var reader = new AccSharedMemory(
    physicsUpdateInterval: 50,
    graphicsUpdateInterval: 100,
    staticInfoUpdateInterval: 2_000);

reader.StaticInfoUpdated += (_, e) =>
{
    lock (snapshotLock)
    {
        staticInfo = e.Data;
    }
};

reader.PhysicsUpdated += (_, e) =>
{
    lock (snapshotLock)
    {
        physics = e.Data;
    }
};

reader.GraphicsUpdated += (_, e) =>
{
    lock (snapshotLock)
    {
        graphics = e.Data;
    }
};

Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cancellation.Cancel();
};

Console.WriteLine("Collector iniciado...");
Console.WriteLine("Abra o Assetto Corsa e entre em uma pista.");
Console.WriteLine("Pressione Ctrl+C para encerrar.\n");
Console.WriteLine("Aguardando shared memory do Assetto Corsa...");

try
{
    await reader.ConnectAsync(cancellation.Token);

    while (!cancellation.Token.IsCancellationRequested)
    {
        StaticInfo? currentStaticInfo;
        Physics? currentPhysics;
        Graphics? currentGraphics;

        lock (snapshotLock)
        {
            currentStaticInfo = staticInfo;
            currentPhysics = physics;
            currentGraphics = graphics;
        }

        RenderTelemetry(reader.Status, currentStaticInfo, currentPhysics, currentGraphics);
        await Task.Delay(100, cancellation.Token);
    }
}
catch (OperationCanceledException)
{
    // Expected when Ctrl+C is pressed.
}
catch (InvalidOperationException ex)
{
    Console.WriteLine();
    Console.WriteLine($"Erro ao conectar na shared memory: {ex.Message}");
}
finally
{
    if (reader.Status == ConnectionState.Connected)
    {
        reader.Disconnect();
    }

    Console.CursorVisible = true;
}

static void RenderTelemetry(
    ConnectionState connectionState,
    StaticInfo? staticInfo,
    Physics? physics,
    Graphics? graphics)
{
    Console.CursorVisible = false;
    Console.Clear();

    Console.WriteLine("=== TELEMETRIA ===\n");
    Console.WriteLine($"Conexao: {connectionState}");
    Console.WriteLine();

    Console.WriteLine($"Carro: {FormatText(staticInfo?.CarModel)}");
    Console.WriteLine($"Pista: {FormatText(staticInfo?.Track)}");
    Console.WriteLine();

    Console.WriteLine($"Velocidade: {FormatNumber(physics?.SpeedKmh, "0")} km/h");
    Console.WriteLine($"RPM: {FormatText(physics?.Rpms)}");
    Console.WriteLine($"Marcha: {FormatText(physics?.Gear)}");
    Console.WriteLine($"Combustivel: {FormatNumber(physics?.Fuel, "0.0")} L");
    Console.WriteLine();

    Console.WriteLine("Temperatura pneus:");
    Console.WriteLine($"Nucleo : {FormatTyreTemperatures(GetTyreCoreTemperature(physics))}");
    Console.WriteLine($"Interna: {FormatTyreTemperatures(GetTyreTempI(physics))}");
    Console.WriteLine($"Meio   : {FormatTyreTemperatures(GetTyreTempM(physics))}");
    Console.WriteLine($"Externa: {FormatTyreTemperatures(GetTyreTempO(physics))}");
    Console.WriteLine();

    Console.WriteLine($"Volta atual: {FormatText(graphics?.CompletedLaps)}");
    Console.WriteLine($"Posicao: {FormatText(graphics?.Position)}");
    Console.WriteLine();

    Console.WriteLine($"Melhor volta: {FormatLapTime(graphics?.BestTime)}");
    Console.WriteLine($"Ultima volta: {FormatLapTime(graphics?.LastTime)}");
}

static string FormatText<T>(T? value)
{
    return value?.ToString() is { Length: > 0 } text ? text : "--";
}

static string FormatNumber(float? value, string format)
{
    return value.HasValue ? value.Value.ToString(format) : "--";
}

static string FormatTyreTemperatures(TyreStat? temperatures)
{
    if (!temperatures.HasValue)
    {
        return "FL -- C | FR -- C | RL -- C | RR -- C";
    }

    var tyre = temperatures.Value;

    return $"FL {FormatNumber(tyre.FrontLeft, "0")} C | " +
        $"FR {FormatNumber(tyre.FrontRight, "0")} C | " +
        $"RL {FormatNumber(tyre.RearLeft, "0")} C | " +
        $"RR {FormatNumber(tyre.RearRight, "0")} C";
}

static TyreStat? GetTyreCoreTemperature(Physics? physics)
{
    return physics.HasValue ? physics.Value.TyreCoreTemperature : null;
}

static TyreStat? GetTyreTempI(Physics? physics)
{
    return physics.HasValue ? physics.Value.TyreTempI : null;
}

static TyreStat? GetTyreTempM(Physics? physics)
{
    return physics.HasValue ? physics.Value.TyreTempM : null;
}

static TyreStat? GetTyreTempO(Physics? physics)
{
    return physics.HasValue ? physics.Value.TyreTempO : null;
}

static string FormatLapTime(int? milliseconds)
{
    return milliseconds is > 0
        ? TimeSpan.FromMilliseconds(milliseconds.Value).ToString(@"hh\:mm\:ss\.fff")
        : "--";
}
