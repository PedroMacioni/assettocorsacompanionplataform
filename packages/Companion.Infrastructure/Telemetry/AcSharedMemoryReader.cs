using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;

namespace Companion.Infrastructure.Telemetry;

public sealed class AcSharedMemoryReader : IDisposable
{
    private const string PhysicsFile  = "Local\\acpmf_physics";
    private const string GraphicsFile = "Local\\acpmf_graphics";
    private const string StaticFile   = "Local\\acpmf_static";

    private MemoryMappedFile? _physicsMap, _graphicsMap, _staticMap;
    private MemoryMappedViewAccessor? _physicsView, _graphicsView, _staticView;

    public bool TryConnect()
    {
        try
        {
            _physicsMap   = MemoryMappedFile.OpenExisting(PhysicsFile);
            _graphicsMap  = MemoryMappedFile.OpenExisting(GraphicsFile);
            _staticMap    = MemoryMappedFile.OpenExisting(StaticFile);
            _physicsView  = _physicsMap.CreateViewAccessor();
            _graphicsView = _graphicsMap.CreateViewAccessor();
            _staticView   = _staticMap.CreateViewAccessor();
            return true;
        }
        catch (FileNotFoundException) { return false; }
    }

    public AcPhysics?  ReadPhysics()  => TryRead<AcPhysics>(_physicsView);
    public AcGraphics? ReadGraphics() => TryRead<AcGraphics>(_graphicsView);
    public AcStatic?   ReadStatic()   => TryRead<AcStatic>(_staticView);

    private static T? TryRead<T>(MemoryMappedViewAccessor? view) where T : struct
    {
        if (view is null) return null;
        view.Read<T>(0, out var result);
        return result;
    }

    public void Dispose()
    {
        _physicsView?.Dispose();
        _graphicsView?.Dispose();
        _staticView?.Dispose();
        _physicsMap?.Dispose();
        _graphicsMap?.Dispose();
        _staticMap?.Dispose();
    }
}
