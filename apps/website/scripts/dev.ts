import { spawn } from 'node:child_process';
import net from 'node:net';

const DEFAULT_PORT = 3100;
const MAX_PORT_ATTEMPTS = 100;

const args = process.argv.slice(2);

const parsePort = (raw: string | undefined): number | null => {
    if (!raw) {
        return null;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        return null;
    }

    return parsed;
};

const getPreferredPort = (): { port: number; passthrough: string[] } => {
    const passthrough: string[] = [];
    let preferredPort = parsePort(process.env.PORT) ?? DEFAULT_PORT;

    for (let i = 0; i < args.length; i += 1) {
        const current = args[i];
        if (current === '--port' || current === '-p') {
            preferredPort = parsePort(args[i + 1]) ?? preferredPort;
            i += 1;
            continue;
        }

        if (current.startsWith('--port=')) {
            preferredPort = parsePort(current.split('=')[1]) ?? preferredPort;
            continue;
        }

        passthrough.push(current);
    }

    return { port: preferredPort, passthrough };
};

const canBindPort = (port: number): Promise<boolean> =>
    new Promise((resolve, reject) => {
        const server = net.createServer();

        server.once('error', error => {
            if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
                resolve(false);
                return;
            }

            reject(error);
        });

        server.once('listening', () => {
            server.close(() => resolve(true));
        });

        server.listen(port, '0.0.0.0');
    });

const findAvailablePort = async (startPort: number): Promise<number> => {
    for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
        const currentPort = startPort + offset;
        if (await canBindPort(currentPort)) {
            return currentPort;
        }
    }

    throw new Error(
        `No open port found in range ${startPort}-${startPort + MAX_PORT_ATTEMPTS - 1}.`
    );
};

const run = async () => {
    const { port: preferredPort, passthrough } = getPreferredPort();
    const selectedPort = await findAvailablePort(preferredPort);

    if (selectedPort !== preferredPort) {
        console.log(
            `[website:dev] Port ${preferredPort} is busy. Starting Next.js on ${selectedPort}.`
        );
    }

    const child = spawn(
        'next',
        ['dev', '--webpack', '-p', String(selectedPort), ...passthrough],
        {
        stdio: 'inherit',
        detached: true,
        env: {
            ...process.env,
            PORT: String(selectedPort),
        },
        }
    );

    let isShuttingDown = false;

    const killChildProcessGroup = (signal: NodeJS.Signals) => {
        if (!child.pid) {
            return;
        }

        try {
            // Negative PID targets the spawned process group.
            process.kill(-child.pid, signal);
        } catch {}
    };

    const shutdown = (signal: NodeJS.Signals) => {
        if (isShuttingDown) {
            return;
        }

        isShuttingDown = true;
        killChildProcessGroup(signal);
        process.exit(signal === 'SIGINT' ? 130 : 143);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('exit', () => {
        killChildProcessGroup('SIGTERM');
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }

        process.exit(code ?? 0);
    });
};

run().catch(error => {
    console.error('[website:dev] Failed to start dev server:', error);
    process.exit(1);
});
