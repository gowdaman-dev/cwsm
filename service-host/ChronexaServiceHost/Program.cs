using ChronexaServiceHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

if (args.Length == 1 && (args[0] == "--version" || args[0] == "-v"))
{
    Console.WriteLine("chronexa-service-host v1.0.0");
    return 0;
}

var options = ServiceHostOptions.TryParse(args, out var error);
if (options is null)
{
    Console.Error.WriteLine($"chronexa-service-host: {error}");
    Console.Error.WriteLine(
        "Usage: chronexa-service-host.exe --service-name <name> --target <path> " +
        "[--args <args>] [--cwd <dir>] [--logdir <dir>]");
    return 1;
}

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(o => o.ServiceName = options.ServiceName);
builder.Services.AddSingleton(options);
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
await host.RunAsync();
return 0;
