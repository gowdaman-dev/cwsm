namespace ChronexaServiceHost;

// Parsed from the command line embedded in the service's own binPath at
// registration time (sc create/config), so it's supplied fresh on every
// start by the Service Control Manager — no separate config file needed.
public sealed class ServiceHostOptions
{
    public required string ServiceName { get; init; }
    public required string Target { get; init; }
    public string TargetArgs { get; init; } = "";
    public string? WorkingDirectory { get; init; }
    public string? LogDirectory { get; init; }

    public static ServiceHostOptions? TryParse(string[] args, out string? error)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }
            var key = args[i][2..];
            var value = (i + 1 < args.Length) ? args[++i] : "";
            map[key] = value;
        }

        if (!map.TryGetValue("service-name", out var serviceName) || string.IsNullOrWhiteSpace(serviceName))
        {
            error = "Missing required --service-name <name>";
            return null;
        }
        if (!map.TryGetValue("target", out var target) || string.IsNullOrWhiteSpace(target))
        {
            error = "Missing required --target <path>";
            return null;
        }

        error = null;
        return new ServiceHostOptions
        {
            ServiceName = serviceName,
            Target = target,
            TargetArgs = map.GetValueOrDefault("args", ""),
            WorkingDirectory = map.TryGetValue("cwd", out var cwd) && !string.IsNullOrWhiteSpace(cwd) ? cwd : null,
            LogDirectory = map.TryGetValue("logdir", out var logdir) && !string.IsNullOrWhiteSpace(logdir) ? logdir : null,
        };
    }
}
