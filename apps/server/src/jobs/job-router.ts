import type { Job, PgBoss, SendOptions, WorkOptions } from 'pg-boss';
import { z } from 'zod';
import { createJobsLogger, type JobsLogger } from './jobs-logger';
import {
    buildStartupSummary,
    createJobLog
} from './job-runtime-utils';

type JobWorkContext = {
    boss: PgBoss;
};

type JobWorkFn<TInput, TResult> = (
    job: Job<TInput>,
    signal: AbortSignal,
    log: ReturnType<typeof createJobLog>,
    context: JobWorkContext
) => Promise<TResult>;

type JobSchedule =
    | {
          type: 'interval';
          everyMs: number;
          payload: object | null;
          sendOptions?: SendOptions;
      }
    | {
          type: 'cron';
          cron: string;
          payload: object | null;
          scheduleOptions?: SendOptions;
      };

type AnyJobDefinition = {
    jobName: string;
    parseInput: (input: unknown) => unknown;
    persistSuccess: 'always' | 'didWork';
    schedule?: JobSchedule;
    sendOptions: SendOptions;
    startupSummary: string;
    work: JobWorkFn<unknown, unknown>;
    workOptions?: WorkOptions;
};

export type StartRegisteredJobsResult = {
    startupSummary: string[];
    stop: () => Promise<void>;
};

const defaultJobsLogger = createJobsLogger({
    scope: 'jobs.router'
});

const registeredJobsByName = new Map<string, AnyJobDefinition>();
let hasStartedJobsRuntime = false;

class JobBuilder<TInput = unknown> {
    private inputSchema: z.ZodType<TInput> = z.unknown() as z.ZodType<TInput>;
    private readonly jobName: string;
    private readonly persistSuccess: 'always' | 'didWork';
    private readonly startupSummary?: string;
    private schedule?: JobSchedule;
    private sendOptions: SendOptions = {};
    private workerOptions?: WorkOptions;

    constructor(
        jobName: string,
        options?: {
            persistSuccess?: 'always' | 'didWork';
            startupSummary?: string;
        }
    ) {
        this.jobName = jobName;
        this.persistSuccess = options?.persistSuccess ?? 'always';
        this.startupSummary = options?.startupSummary;
    }

    input<TNextInput>(schema: z.ZodType<TNextInput>) {
        this.inputSchema = schema as unknown as z.ZodType<TInput>;
        return this as unknown as JobBuilder<TNextInput>;
    }

    options(options: SendOptions) {
        this.sendOptions = {
            ...this.sendOptions,
            ...options
        };

        return this;
    }

    workOptions(options: WorkOptions) {
        this.workerOptions = options;
        return this;
    }

    interval(params: {
        everyMs: number;
        payload?: object | null;
        sendOptions?: SendOptions;
    }) {
        this.schedule = {
            type: 'interval',
            everyMs: params.everyMs,
            payload: params.payload ?? {},
            sendOptions: params.sendOptions
        };

        return this;
    }

    cron(params: {
        cron: string;
        payload?: object | null;
        scheduleOptions?: SendOptions;
    }) {
        this.schedule = {
            type: 'cron',
            cron: params.cron,
            payload: params.payload ?? {},
            scheduleOptions: params.scheduleOptions
        };

        return this;
    }

    work<TResult>(workFn: JobWorkFn<TInput, TResult>) {
        const definition: AnyJobDefinition = {
            jobName: this.jobName,
            parseInput: (input) => this.inputSchema.parse(input),
            persistSuccess: this.persistSuccess,
            schedule: this.schedule,
            sendOptions: this.sendOptions,
            startupSummary:
                this.startupSummary ??
                buildStartupSummary(this.schedule, this.sendOptions),
            work: workFn as JobWorkFn<unknown, unknown>,
            workOptions: this.workerOptions
        };

        const existingDefinition = registeredJobsByName.get(this.jobName);
        if (existingDefinition && existingDefinition !== definition) {
            throw new Error(`Job already registered: ${this.jobName}`);
        }

        registeredJobsByName.set(this.jobName, definition);
        return definition;
    }
}

export const defineJob = (
    jobName: string,
    options?: {
        persistSuccess?: 'always' | 'didWork';
        startupSummary?: string;
    }
) => {
    return new JobBuilder(jobName, options);
};

export const startRegisteredJobs = async (params: {
    boss: PgBoss;
    logger?: JobsLogger;
}): Promise<StartRegisteredJobsResult> => {
    if (hasStartedJobsRuntime) {
        throw new Error(
            '[Jobs] startRegisteredJobs() can only be called once per process.'
        );
    }

    const logger = params.logger
        ? createJobsLogger({
              baseLogger: params.logger,
              scope: 'jobs.router'
          })
        : defaultJobsLogger;
    const jobs = Array.from(registeredJobsByName.values());
    const intervalTimers: NodeJS.Timeout[] = [];
    const createdQueues = new Set<string>();

    for (const jobDefinition of jobs) {
        if (createdQueues.has(jobDefinition.jobName)) {
            continue;
        }

        await params.boss.createQueue(jobDefinition.jobName);
        createdQueues.add(jobDefinition.jobName);
    }

    for (const jobDefinition of jobs) {
        const worker = async (incomingJobs: Job<unknown> | Job<unknown>[]) => {
            const queuedJobs = Array.isArray(incomingJobs)
                ? incomingJobs
                : [incomingJobs];

            for (const queuedJob of queuedJobs) {
                let parsedInput: unknown;

                try {
                    parsedInput = jobDefinition.parseInput(queuedJob.data);
                } catch (error) {
                    logger.warn(
                        {
                            error,
                            jobId: queuedJob.id,
                            jobName: jobDefinition.jobName
                        },
                        'Skipping job with invalid payload.'
                    );
                    continue;
                }

                const typedJob = {
                    ...queuedJob,
                    data: parsedInput
                } as Job<unknown>;
                const signal = new AbortController().signal;
                const log = createJobLog(jobDefinition.jobName, logger);

                try {
                    const result = await jobDefinition.work(
                        typedJob,
                        signal,
                        log,
                        {
                            boss: params.boss
                        }
                    );

                    if (jobDefinition.persistSuccess === 'didWork') {
                        if (
                            typeof result === 'object' &&
                            result !== null &&
                            'didWork' in result
                        ) {
                            const didWork = (
                                result as {
                                    didWork?: unknown;
                                }
                            ).didWork;

                            if (didWork !== true) {
                                continue;
                            }
                        }
                    }
                } catch (error) {
                    logger.error(
                        {
                            error,
                            jobId: queuedJob.id,
                            jobName: jobDefinition.jobName
                        },
                        'Job execution failed.'
                    );
                    throw error;
                }
            }
        };

        if (jobDefinition.workOptions) {
            await params.boss.work(
                jobDefinition.jobName,
                jobDefinition.workOptions,
                worker
            );
        } else {
            await params.boss.work(jobDefinition.jobName, worker);
        }

        if (!jobDefinition.schedule) {
            continue;
        }

        if (jobDefinition.schedule.type === 'interval') {
            const intervalSchedule = jobDefinition.schedule;
            const timer = setInterval(() => {
                void params.boss
                    .send(
                        jobDefinition.jobName,
                        intervalSchedule.payload,
                        {
                            ...jobDefinition.sendOptions,
                            ...intervalSchedule.sendOptions
                        }
                    )
                    .catch((error) => {
                        logger.error(
                            {
                                error,
                                jobName: jobDefinition.jobName
                            },
                            'Failed to enqueue interval job.'
                        );
                    });
            }, jobDefinition.schedule.everyMs);

            intervalTimers.push(timer);
            continue;
        }

        await params.boss.schedule(
            jobDefinition.jobName,
            jobDefinition.schedule.cron,
            jobDefinition.schedule.payload,
            {
                ...jobDefinition.sendOptions,
                ...jobDefinition.schedule.scheduleOptions
            }
        );
    }

    hasStartedJobsRuntime = true;

    return {
        startupSummary: jobs.map((jobDefinition) => {
            return `${jobDefinition.jobName} (${jobDefinition.startupSummary})`;
        }),
        stop: async () => {
            for (const timer of intervalTimers) {
                clearInterval(timer);
            }
            hasStartedJobsRuntime = false;
        }
    };
};
