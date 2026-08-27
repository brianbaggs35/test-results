import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { IncomingWebhookHTTPError } from '@slack/webhook';
import { createPublishHandler, publishPlugin } from './publishPlugin';

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}

function createMockReq(method: string, body: string): IncomingMessage {
  let dataCb: ((chunk: Buffer) => void) | undefined;
  const req = {
    method,
    on(event: string, cb: (arg?: unknown) => void) {
      if (event === 'data') dataCb = cb as (chunk: Buffer) => void;
      if (event === 'end') {
        dataCb?.(Buffer.from(body));
        cb();
      }
      return req;
    },
  };
  return req as unknown as IncomingMessage;
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      res.headers[name] = value;
    },
    end(chunk) {
      res.body = chunk ?? '';
    },
  };
  return res;
}

const validTestData = {
  summary: { total: 1, passed: 1, failed: 0, skipped: 0, time: 1 },
  suites: [{ name: 'Suite A', tests: 1, failures: 0, errors: 0, skipped: 0, time: 1 }],
};

describe('createPublishHandler', () => {
  it('rejects non-POST requests', async () => {
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x' });
    const req = createMockReq('GET', '');
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'Method not allowed' });
  });

  it('rejects a body that is not valid JSON', async () => {
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x' });
    const req = createMockReq('POST', '{not json');
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('rejects a body missing required fields', async () => {
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x' });
    const req = createMockReq('POST', JSON.stringify({ metadata: [] }));
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'Title and testData are required.' });
  });

  it('rejects a body whose testData is missing suites', async () => {
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x' });
    const req = createMockReq(
      'POST',
      JSON.stringify({ title: 'Title', metadata: [], testData: { summary: {} } })
    );
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(400);
  });

  it('returns 503 when no webhook URL is configured', async () => {
    const handler = createPublishHandler({});
    const req = createMockReq(
      'POST',
      JSON.stringify({ title: 'Title', metadata: [], testData: validTestData })
    );
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toContain('SLACK_WEBHOOK_URL');
  });

  it('sends the built message to Slack and returns success', async () => {
    const sendToSlack = vi.fn().mockResolvedValue({ text: 'ok' });
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x', sendToSlack });
    const req = createMockReq(
      'POST',
      JSON.stringify({ title: 'Title', metadata: [], testData: validTestData })
    );
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
    expect(sendToSlack).toHaveBeenCalledTimes(1);
    const [calledUrl, calledMessage] = sendToSlack.mock.calls[0];
    expect(calledUrl).toBe('https://hooks.slack.com/services/x');
    expect(calledMessage.attachments[0].color).toBe('good');
  });

  it('returns 502 with the underlying message when the Slack send fails', async () => {
    const sendToSlack = vi.fn().mockRejectedValue(new Error('invalid_payload'));
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x', sendToSlack });
    const req = createMockReq(
      'POST',
      JSON.stringify({ title: 'Title', metadata: [], testData: validTestData })
    );
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'invalid_payload' });
  });

  it('surfaces Slack\'s own rejection reason from an IncomingWebhookHTTPError body', async () => {
    // Reproduces a real rejection observed from the live Slack API: the
    // generic error.message is just "An HTTP protocol error occurred:
    // statusCode = 400", which tells the user nothing actionable — the
    // useful reason is in the HTTP error's body.
    const sendToSlack = vi.fn().mockRejectedValue(new IncomingWebhookHTTPError(400, 'Bad Request', 'invalid_payload'));
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x', sendToSlack });
    const req = createMockReq(
      'POST',
      JSON.stringify({ title: 'Title', metadata: [], testData: validTestData })
    );
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'invalid_payload' });
  });

  it('falls back to a generic message when the Slack send rejects with a non-Error', async () => {
    const sendToSlack = vi.fn().mockRejectedValue('boom');
    const handler = createPublishHandler({ webhookUrl: 'https://hooks.slack.com/services/x', sendToSlack });
    const req = createMockReq(
      'POST',
      JSON.stringify({ title: 'Title', metadata: [], testData: validTestData })
    );
    const res = createMockRes();

    await handler(req, res as unknown as ServerResponse);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'Failed to publish to Slack.' });
  });
});

describe('publishPlugin', () => {
  it('registers the publish handler as dev-server middleware', () => {
    const use = vi.fn();
    const plugin = publishPlugin({ webhookUrl: 'https://hooks.slack.com/services/x' });

    expect(plugin.name).toBe('slack-publish');
    // configureServer is typed as a Vite hook (function or {handler} object); invoke it directly.
    const configureServer = plugin.configureServer as (server: { middlewares: { use: typeof use } }) => void;
    configureServer({ middlewares: { use } });

    expect(use).toHaveBeenCalledWith('/api/publish', expect.any(Function));
  });
});
