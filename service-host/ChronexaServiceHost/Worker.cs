using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ChronexaServiceHost;

// Supervises exactly one child process for the lifetime of the Windows
// service: starts it when the SCM starts the service, stops it (and this
// host, so the SCM sees the service stop too) when either side ends.
public sealed class Worker : BackgroundService
{
    private readonly ServiceHostOptions _options;
    private readonly ILogger<Worker> _logger;
    private readonly IHostApplicationLifetime _lifetime;

    public Worker(ServiceHostOptions options, ILogger<Worker> logger, IHostApplicationLifetime lifetime)
    {
        _options = options;
        _logger = logger;
        _lifetime = lifetime;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        StreamWriter? stdoutLog = null;
        StreamWriter? stderrLog = null;
        Process? process = null;

        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = _options.Target,
                Arguments = _options.TargetArgs,
                WorkingDirectory = _options.WorkingDirectory
                    ?? Path.GetDirectoryName(Path.GetFullPath(_options.Target))
                    ?? Environment.CurrentDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            if (!string.IsNullOrEmpty(_options.LogDirectory))
            {
                Directory.CreateDirectory(_options.LogDirectory);
                startInfo.EnvironmentVariables["LOG_DIR"] = _options.LogDirectory;

                stdoutLog = new StreamWriter(Path.Combine(_options.LogDirectory, "stdout.log"), append: true) { AutoFlush = true };
                stderrLog = new StreamWriter(Path.Combine(_options.LogDirectory, "stderr.log"), append: true) { AutoFlush = true };
                startInfo.RedirectStandardOutput = true;
                startInfo.RedirectStandardError = true;
            }

            process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

            if (stdoutLog != null)
            {
                process.OutputDataReceived += (_, e) =>
                {
                    if (e.Data != null) stdoutLog.WriteLine($"[{DateTimeOffset.Now:O}] {e.Data}");
                };
            }
            if (stderrLog != null)
            {
                process.ErrorDataReceived += (_, e) =>
                {
                    if (e.Data != null) stderrLog.WriteLine($"[{DateTimeOffset.Now:O}] {e.Data}");
                };
            }

            _logger.LogInformation(
                "Starting \"{Target}\" {Args} (cwd: {Cwd}) for service {Service}",
                _options.Target, _options.TargetArgs, startInfo.WorkingDirectory, _options.ServiceName);

            process.Start();
            if (stdoutLog != null) process.BeginOutputReadLine();
            if (stderrLog != null) process.BeginErrorReadLine();

            // If the child dies on its own, stop the host so the SCM
            // reflects the service as stopped instead of a zombie RUNNING.
            process.Exited += (_, _) =>
            {
                _logger.LogWarning("Child process for {Service} exited with code {Code}", _options.ServiceName, process.ExitCode);
                _lifetime.StopApplication();
            };

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Normal path: the SCM asked us to stop.
        }
        finally
        {
            if (process is { HasExited: false })
            {
                try
                {
                    _logger.LogInformation("Stopping child process for service {Service}", _options.ServiceName);
                    process.Kill(entireProcessTree: true);
                    process.WaitForExit(5000);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to stop child process for service {Service}", _options.ServiceName);
                }
            }
            stdoutLog?.Dispose();
            stderrLog?.Dispose();
        }
    }
}
