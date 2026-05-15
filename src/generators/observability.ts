import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig } from '../types/index.js';

export async function generateLangfuseObservability(projectPath: string, config: ProjectConfig, ext: string) {
  await fs.ensureDir(path.join(projectPath, 'src/services'));

  await fs.outputFile(path.join(projectPath, `src/services/langfuse.service.${ext}`), generateLangfuseService(config, ext));
  await fs.outputFile(path.join(projectPath, `src/instrumentation.${ext}`), generateInstrumentation(config, ext));
}

function generateLangfuseService(config: ProjectConfig, ext: string): string {
  const isTS = ext === 'ts';

  return isTS
    ? `import { randomUUID } from 'node:crypto';
import { LangfuseAPIClient } from '@langfuse/core';

import { config, env } from '../config/config.js';
import logger from '../utils/logger.js';

type ObservationLevel = 'DEFAULT' | 'ERROR';

interface LogGenerationParams {
  name: string;
  model: string;
  startedAt: string;
  endedAt: string;
  input?: unknown;
  output?: unknown;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  level?: ObservationLevel;
  statusMessage?: string;
  metadata?: Record<string, unknown>;
}

interface IngestionBatchEvent {
  id: string;
  type: 'trace-create' | 'generation-create';
  timestamp: string;
  body: Record<string, unknown>;
}

let client: LangfuseAPIClient | null = null;

const isConfigured = () => Boolean(config.langfusePublicKey && config.langfuseSecretKey && config.langfuseBaseUrl);

const getClient = () => {
  if (!isConfigured()) {
    return null;
  }

  if (client) {
    return client;
  }

  client = new LangfuseAPIClient({
    environment: config.langfuseBaseUrl,
    baseUrl: config.langfuseBaseUrl,
    username: config.langfusePublicKey,
    password: config.langfuseSecretKey,
    xLangfusePublicKey: config.langfusePublicKey,
  });

  return client;
};

const removeUndefined = <T extends Record<string, unknown>>(payload: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const sendBatch = async (batch: IngestionBatchEvent[]) => {
  const langfuseClient = getClient();
  if (!langfuseClient || batch.length === 0) {
    return;
  }

  try {
    const response = await langfuseClient.ingestion.batch({ batch });
    if (response.errors.length > 0) {
      logger.warn('Langfuse ingestion completed with partial errors', {
        errorCount: response.errors.length,
      });
    }
  } catch (error: unknown) {
    logger.warn('Langfuse ingestion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const langfuseService = {
  isEnabled() {
    return isConfigured();
  },

  async logGeneration(params: LogGenerationParams) {
    if (!isConfigured()) {
      return;
    }

    const traceId = randomUUID();
    const generationId = randomUUID();
    const now = new Date().toISOString();
    const tags = Array.from(new Set([...(params.tags || []), '${config.name}', env]));

    const traceEvent: IngestionBatchEvent = {
      id: randomUUID(),
      type: 'trace-create',
      timestamp: now,
      body: removeUndefined({
        id: traceId,
        timestamp: params.startedAt,
        name: params.name,
        userId: params.userId,
        sessionId: params.sessionId,
        input: params.input,
        output: params.output,
        metadata: params.metadata,
        tags,
      }),
    };

    const generationEvent: IngestionBatchEvent = {
      id: randomUUID(),
      type: 'generation-create',
      timestamp: now,
      body: removeUndefined({
        id: generationId,
        traceId,
        name: params.name,
        startTime: params.startedAt,
        endTime: params.endedAt,
        model: params.model,
        input: params.input,
        output: params.output,
        level: params.level,
        statusMessage: params.statusMessage,
        metadata: params.metadata,
      }),
    };

    await sendBatch([traceEvent, generationEvent]);
  },
};

export default langfuseService;
`
    : `import { randomUUID } from 'node:crypto';
import { LangfuseAPIClient } from '@langfuse/core';

import { config, env } from '../config/config.js';
import logger from '../utils/logger.js';

let client = null;

const isConfigured = () => Boolean(config.langfusePublicKey && config.langfuseSecretKey && config.langfuseBaseUrl);

const getClient = () => {
  if (!isConfigured()) {
    return null;
  }

  if (client) {
    return client;
  }

  client = new LangfuseAPIClient({
    environment: config.langfuseBaseUrl,
    baseUrl: config.langfuseBaseUrl,
    username: config.langfusePublicKey,
    password: config.langfuseSecretKey,
    xLangfusePublicKey: config.langfusePublicKey,
  });

  return client;
};

const removeUndefined = (payload) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const sendBatch = async (batch) => {
  const langfuseClient = getClient();
  if (!langfuseClient || batch.length === 0) {
    return;
  }

  try {
    const response = await langfuseClient.ingestion.batch({ batch });
    if (response.errors.length > 0) {
      logger.warn('Langfuse ingestion completed with partial errors', {
        errorCount: response.errors.length,
      });
    }
  } catch (error) {
    logger.warn('Langfuse ingestion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const langfuseService = {
  isEnabled() {
    return isConfigured();
  },

  async logGeneration(params) {
    if (!isConfigured()) {
      return;
    }

    const traceId = randomUUID();
    const generationId = randomUUID();
    const now = new Date().toISOString();
    const tags = Array.from(new Set([...(params.tags || []), '${config.name}', env]));

    await sendBatch([
      {
        id: randomUUID(),
        type: 'trace-create',
        timestamp: now,
        body: removeUndefined({
          id: traceId,
          timestamp: params.startedAt,
          name: params.name,
          userId: params.userId,
          sessionId: params.sessionId,
          input: params.input,
          output: params.output,
          metadata: params.metadata,
          tags,
        }),
      },
      {
        id: randomUUID(),
        type: 'generation-create',
        timestamp: now,
        body: removeUndefined({
          id: generationId,
          traceId,
          name: params.name,
          startTime: params.startedAt,
          endTime: params.endedAt,
          model: params.model,
          input: params.input,
          output: params.output,
          level: params.level,
          statusMessage: params.statusMessage,
          metadata: params.metadata,
        }),
      },
    ]);
  },
};

export default langfuseService;
`;
}

function generateInstrumentation(config: ProjectConfig, ext: string): string {
  const isTS = ext === 'ts';

  return `${isTS ? "import { NodeSDK } from '@opentelemetry/sdk-node';\n" : "import { NodeSDK } from '@opentelemetry/sdk-node';\n"}import { LangfuseSpanProcessor } from '@langfuse/otel';

import { config } from './config/config.js';
import logger from './utils/logger.js';

const SERVICE_NAME = '${config.name}';

let telemetrySdk${isTS ? ': NodeSDK | null' : ''} = null;
let initializePromise${isTS ? ': Promise<void> | null' : ''} = null;
let shutdownPromise${isTS ? ': Promise<void> | null' : ''} = null;

const isLangfuseTracingConfigured = Boolean(config.langfusePublicKey && config.langfuseSecretKey);

const getErrorMessage = (error${isTS ? ': unknown' : ''})${isTS ? ': string' : ''} => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const initializeTelemetry = async () => {
  if (telemetrySdk) {
    return;
  }

  if (initializePromise) {
    return initializePromise;
  }

  if (!isLangfuseTracingConfigured) {
    logger.info('Skipping OpenTelemetry initialization because Langfuse credentials are not configured.');
    return;
  }

  initializePromise = (async () => {
    try {
      telemetrySdk = new NodeSDK({
        serviceName: SERVICE_NAME,
        spanProcessors: [
          new LangfuseSpanProcessor({
            publicKey: config.langfusePublicKey,
            secretKey: config.langfuseSecretKey,
            baseUrl: config.langfuseBaseUrl,
            environment: config.nodeEnv,
          }),
        ],
      });

      await Promise.resolve(telemetrySdk.start());

      logger.info('Initialized OpenTelemetry for Langfuse.', {
        serviceName: SERVICE_NAME,
        environment: config.nodeEnv,
        baseUrl: config.langfuseBaseUrl,
      });
    } catch (error${isTS ? ': unknown' : ''}) {
      telemetrySdk = null;
      logger.warn('Failed to initialize OpenTelemetry for Langfuse.', {
        error: getErrorMessage(error),
      });
    } finally {
      initializePromise = null;
    }
  })();

  return initializePromise;
};

export const shutdownTelemetry = async () => {
  if (!telemetrySdk) {
    return;
  }

  if (shutdownPromise) {
    return shutdownPromise;
  }

  const sdk = telemetrySdk;

  shutdownPromise = (async () => {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry shutdown complete.');
    } catch (error${isTS ? ': unknown' : ''}) {
      logger.warn('OpenTelemetry shutdown failed.', {
        error: getErrorMessage(error),
      });
    } finally {
      telemetrySdk = null;
      shutdownPromise = null;
    }
  })();

  return shutdownPromise;
};
`;
}
