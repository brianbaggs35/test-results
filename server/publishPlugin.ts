import type { Plugin } from 'vite';
import { IncomingWebhook, IncomingWebhookHTTPError } from '@slack/webhook';
import type { IncomingWebhookSendArguments } from '@slack/webhook';
import type { IncomingMessage, ServerResponse } from 'http';
import { buildSlackMessage } from './slackMessage.ts';
import type { SlackMetadataEntry, SlackTestData } from './slackMessage.ts';

interface PublishRequestBody {
  title: string;
  metadata: SlackMetadataEntry[];
  testData: SlackTestData;
}

interface PublishResult {
  success: boolean;
  error?: string;
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isValidRequestBody(data: Partial<PublishRequestBody>): data is PublishRequestBody {
  return (
    typeof data.title === 'string' &&
    Array.isArray(data.metadata) &&
    !!data.testData &&
    typeof data.testData === 'object' &&
    !!data.testData.summary &&
    Array.isArray(data.testData.suites)
  );
}

function sendJson(res: ServerResponse, statusCode: number, body: PublishResult) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Slack's own rejection reason (e.g. "invalid_payload", "channel_not_found")
// lives in the HTTP error's body, not its generic `.message` — surface that
// when it's available so a failed publish says why, not just that it failed.
function extractSlackErrorMessage(err: unknown): string {
  if (err instanceof IncomingWebhookHTTPError && err.body) {
    return err.body;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Failed to publish to Slack.';
}

export interface CreatePublishHandlerOptions {
  webhookUrl?: string;
  /** Injectable for testing; defaults to posting through @slack/webhook. */
  sendToSlack?: (webhookUrl: string, message: IncomingWebhookSendArguments) => Promise<unknown>;
}

const defaultSendToSlack = (webhookUrl: string, message: IncomingWebhookSendArguments) =>
  new IncomingWebhook(webhookUrl).send(message);

export function createPublishHandler(options: CreatePublishHandlerOptions = {}) {
  const sendToSlack = options.sendToSlack ?? defaultSendToSlack;

  return async function handlePublishRequest(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { success: false, error: 'Method not allowed' });
      return;
    }

    let data: Partial<PublishRequestBody>;
    try {
      const rawBody = await parseBody(req);
      data = JSON.parse(rawBody);
    } catch {
      sendJson(res, 400, { success: false, error: 'Request body must be valid JSON.' });
      return;
    }

    if (!isValidRequestBody(data)) {
      sendJson(res, 400, { success: false, error: 'Title and testData are required.' });
      return;
    }

    if (!options.webhookUrl) {
      sendJson(res, 503, {
        success: false,
        error: 'Slack publishing is not configured. Set SLACK_WEBHOOK_URL in your .env file and restart the dev server.',
      });
      return;
    }

    try {
      const message = buildSlackMessage(data.testData, {
        title: data.title,
        metadata: data.metadata,
      });
      await sendToSlack(options.webhookUrl, message);
      sendJson(res, 200, { success: true });
    } catch (err) {
      sendJson(res, 502, { success: false, error: extractSlackErrorMessage(err) });
    }
  };
}

export function publishPlugin(options: { webhookUrl?: string } = {}): Plugin {
  return {
    name: 'slack-publish',
    configureServer(server) {
      server.middlewares.use('/api/publish', createPublishHandler(options));
    },
  };
}
