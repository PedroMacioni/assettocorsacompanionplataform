using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace CompanionAgent.Tray;

public record RetryItem(
    string Id,
    Func<Task<bool>> Action,
    int Attempts = 0,
    DateTime? NextRetry = null
);

public class RetryQueue : IDisposable
{
    private readonly ConcurrentQueue<RetryItem> _queue = new();
    private readonly int _maxAttempts;
    private readonly int _baseDelayMs;
    private System.Threading.Timer? _processTimer;
    private readonly object _timerLock = new();
    private bool _disposed;

    public RetryQueue(int maxAttempts = 5, int baseDelayMs = 30000)
    {
        _maxAttempts = maxAttempts;
        _baseDelayMs = baseDelayMs;
    }

    public void Enqueue(string id, Func<Task<bool>> action)
    {
        if (_disposed) return;
        _queue.Enqueue(new RetryItem(id, action));
        EnsureTimerRunning();
    }

    public async Task ProcessAsync(CancellationToken ct)
    {
        var itemsToRequeue = new List<RetryItem>();

        while (_queue.TryDequeue(out var item))
        {
            if (ct.IsCancellationRequested) break;

            if (item.NextRetry.HasValue && DateTime.UtcNow < item.NextRetry.Value)
            {
                itemsToRequeue.Add(item);
                continue;
            }

            try
            {
                var success = await item.Action();
                if (!success && item.Attempts < _maxAttempts)
                {
                    var delay = _baseDelayMs * Math.Pow(2, item.Attempts);
                    var nextRetry = DateTime.UtcNow.AddMilliseconds(delay);
                    itemsToRequeue.Add(item with {
                        Attempts = item.Attempts + 1,
                        NextRetry = nextRetry
                    });
                }
            }
            catch
            {
                if (item.Attempts < _maxAttempts)
                {
                    var delay = _baseDelayMs * Math.Pow(2, item.Attempts);
                    var nextRetry = DateTime.UtcNow.AddMilliseconds(delay);
                    itemsToRequeue.Add(item with {
                        Attempts = item.Attempts + 1,
                        NextRetry = nextRetry
                    });
                }
            }
        }

        // Re-enqueue items that need retry
        foreach (var item in itemsToRequeue)
        {
            _queue.Enqueue(item);
        }
    }

    private void EnsureTimerRunning()
    {
        lock (_timerLock)
        {
            if (_disposed) return;
            _processTimer ??= new System.Threading.Timer(
                _ => _ = ProcessAsync(CancellationToken.None),
                null,
                _baseDelayMs,
                _baseDelayMs
            );
        }
    }

    public int Count => _queue.Count;

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        lock (_timerLock)
        {
            _processTimer?.Dispose();
            _processTimer = null;
        }
    }
}
