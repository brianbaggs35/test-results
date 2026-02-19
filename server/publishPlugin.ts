import type { Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { resolve } from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

interface MetadataEntry {
  key: string;
  value: string;
}

interface PublishRequestBody {
  run: string;
  title: string;
  metadata: MetadataEntry[];
  xmlContent?: string;
}

interface ConfigExtension {
  name: string;
  inputs?: {
    data?: MetadataEntry[];
  };
}

interface TestBeatsConfig {
  api_key: string;
  project: string;
  run: string;
  targets: Array<{
    name: string;
    inputs: {
      url: string;
      publish: string;
      title: string;
    };
    extensions: ConfigExtension[];
  }>;
  results: Array<{
    type: string;
    files: string[];
  }>;
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

export function publishPlugin(): Plugin {
  return {
    name: 'testbeats-publish',
    configureServer(server) {
      server.middlewares.use('/api/publish', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const rawBody = await parseBody(req);
          const data: PublishRequestBody = JSON.parse(rawBody);
          const projectRoot = process.cwd();
          const configPath = resolve(projectRoot, 'testbeats.config.json');

          // Read current config
          const config: TestBeatsConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

          // Update run
          config.run = data.run;

          // Update title in targets
          if (config.targets?.[0]?.inputs) {
            config.targets[0].inputs.title = data.title;
          }

          // Update metadata
          if (config.targets?.[0]?.extensions) {
            const metadataExt = config.targets[0].extensions.find(
              (ext: ConfigExtension) => ext.name === 'metadata'
            );
            if (metadataExt?.inputs?.data && data.metadata) {
              metadataExt.inputs.data = data.metadata.map(m => ({
                key: m.key,
                value: m.value,
              }));
            }
          }

          // Handle XML content
          if (data.xmlContent) {
            const xmlPath = resolve(projectRoot, 'results.xml');
            writeFileSync(xmlPath, data.xmlContent, 'utf-8');
            if (config.results?.[0]) {
              config.results[0].files = [xmlPath];
            }
          }

          // Write updated config
          writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');

          // Execute testbeats command
          exec(
            'npx testbeats@latest publish -c testbeats.config.json',
            { cwd: projectRoot, timeout: 60000 },
            (error, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({
                  success: false,
                  error: error.message,
                  stdout,
                  stderr,
                }));
                return;
              }

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                stdout,
                stderr,
              }));
            }
          );
        } catch (err) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 400;
          res.end(JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          }));
        }
      });
    },
  };
}
