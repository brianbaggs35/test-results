import { describe, it, expect, vi } from 'vitest';
import {
  AcliError,
  SEARCH_FIELDS,
  VIEW_FIELDS,
  REVIEWER_FIELD,
  APPROVAL_FIELD,
  REVIEW_INFO_FIELD,
  APPROVAL_OPTION_IDS,
  MAX_REVIEW_INFO_CHARS,
  REVIEW_BACKUP_DIR,
  REVIEW_EDIT_DIR_PREFIX,
  appendReviewPanel,
  assertReviewEditPayload,
  buildReviewPanel,
  fromAdf,
  parseApproval,
  parseReviewPanel,
  assertAllowedAcliCommand,
  createJiraClient,
  listReviewJql,
  oneReviewTicketJql,
  parseIssues,
} from './acli';
import type { AcliResult, AcliRunner } from './acli';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const settings = { reviewStatus: 'Review', doneStatus: 'Done' };
const ok = (stdout = '[]'): AcliResult => ({ code: 0, stdout, stderr: '' });

const search = (jql: string, fields = SEARCH_FIELDS) => ['jira', 'workitem', 'search', '--jql', jql, '--fields', fields, '--limit', '100', '--json'];
const view = (key: string, fields = VIEW_FIELDS) => ['jira', 'workitem', 'view', key, '--fields', fields, '--json'];
const transition = (key: string, status = 'Done') => ['jira', 'workitem', 'transition', '--key', key, '--status', status, '--yes'];

describe('AT-only guard rail: assertAllowedAcliCommand', () => {
  it('allows exactly the two permitted operations', () => {
    expect(() => assertAllowedAcliCommand(search(listReviewJql('Review')), settings)).not.toThrow();
    expect(() => assertAllowedAcliCommand(search(oneReviewTicketJql('AT-727', 'Review')), settings)).not.toThrow();
    expect(() => assertAllowedAcliCommand(transition('AT-727'), settings)).not.toThrow();
    expect(() => assertAllowedAcliCommand(view('AT-728'), settings)).not.toThrow();
    expect(() => assertAllowedAcliCommand(transition('AT-1', 'Completed'), { ...settings, doneStatus: 'Completed' })).not.toThrow();
  });

  it.each([
    ['another Jira project', search('project = "APP" AND status = "Review" ORDER BY updated DESC')],
    ['the manual-testing project', search('project = "MT" AND status = "Review" ORDER BY updated DESC')],
    ['all projects', search('status = "Review"')],
    ['a different column', search('project = "AT" AND status = "Done" ORDER BY updated DESC')],
    ['free-form JQL appended', search('project = "AT" AND status = "Review" OR project = "APP" ORDER BY updated DESC')],
    ['JQL that widens via a second clause', search('project = "AT" AND status = "Review" ORDER BY updated DESC; project = APP')],
    ['a key from another project', search('key = "APP-1" AND status = "Review"')],
    ['several keys in a read', search('key = "AT-1,APP-2" AND status = "Review"')],
    ['an OR on the key', search('key = "AT-1" OR key = "APP-2" AND status = "Review"')],
    ['a filter id', ['jira', 'workitem', 'search', '--filter', '10001', '--fields', SEARCH_FIELDS, '--limit', '100', '--json']],
    ['extra fields', search(listReviewJql('Review'), 'key,summary,customfield_10550')],
    ['a bigger limit', ['jira', 'workitem', 'search', '--jql', listReviewJql('Review'), '--fields', SEARCH_FIELDS, '--limit', '5000', '--json']],
    ['a trailing extra flag', [...search(listReviewJql('Review')), '--web']],
  ])('blocks a search with %s', (_name, args) => {
    expect(() => assertAllowedAcliCommand(args, settings)).toThrow(/AT-only guard rail/);
  });

  it.each([
    ['another project ticket', transition('APP-123')],
    ['an MT ticket', transition('MT-5')],
    ['several keys', transition('AT-1,AT-2')],
    ['AT key plus another', transition('AT-1,APP-2')],
    ['a key with whitespace', transition('AT-1 ')],
    ['a lowercase key', transition('at-1')],
    ['a JQL instead of a key', ['jira', 'workitem', 'transition', '--jql', 'project = AT', '--status', 'Done', '--yes']],
    ['a filter instead of a key', ['jira', 'workitem', 'transition', '--filter', '10001', '--status', 'Done', '--yes']],
    ['moving it back to In Progress', transition('AT-1', 'In Progress')],
    ['moving it to a column other than done', transition('AT-1', 'Review')],
    ['a status that merely contains Done', transition('AT-1', 'Done; rm -rf')],
    ['ignoring errors', [...transition('AT-1'), '--ignore-errors']],
    ['a missing --yes', ['jira', 'workitem', 'transition', '--key', 'AT-1', '--status', 'Done']],
  ])('blocks a transition with %s', (_name, args) => {
    expect(() => assertAllowedAcliCommand(args, settings)).toThrow(/AT-only guard rail/);
  });

  it.each([
    ['delete a work item', ['jira', 'workitem', 'delete', '--key', 'AT-1', '--yes']],
    ['edit a work item', ['jira', 'workitem', 'edit', '--key', 'AT-1', '--summary', 'x']],
    ['create a work item', ['jira', 'workitem', 'create', '--project', 'AT', '--summary', 'x', '--type', 'Task']],
    ['comment', ['jira', 'workitem', 'comment', 'create', '--key', 'AT-1', '--body', 'x']],
    ['assign', ['jira', 'workitem', 'assign', '--key', 'AT-1', '--assignee', 'x']],
    ['view a work item', ['jira', 'workitem', 'view', 'AT-1']],
    ['list projects', ['jira', 'project', 'list']],
    ['log out', ['auth', 'logout']],
    ['log in', ['auth', 'login']],
    ['confluence', ['confluence', 'space', 'list']],
    ['no arguments', []],
  ])('blocks any other acli command: %s', (_name, args) => {
    expect(() => assertAllowedAcliCommand(args, settings)).toThrow(AcliError);
  });

  it('rejects non-string arguments', () => {
    expect(() => assertAllowedAcliCommand(['jira', 5 as unknown as string], settings)).toThrow(/invalid arguments/);
  });
});

describe('AT-only guard rail: reading one ticket (view)', () => {
  it('uses the AT board\'s real field ids', () => {
    expect(REVIEWER_FIELD).toBe('customfield_10550');
    expect(APPROVAL_FIELD).toBe('customfield_10650');
    expect(REVIEW_INFO_FIELD).toBe('customfield_10652');
    expect(APPROVAL_OPTION_IDS).toEqual({ approved: '10478', declined: '10479' });
    expect(VIEW_FIELDS).toBe('key,summary,status,assignee,customfield_10550,customfield_10650,customfield_10652,description');
  });

  it.each([
    ['another project ticket', view('APP-1')],
    ['an MT ticket', view('MT-5')],
    ['several keys', view('AT-1,AT-2')],
    ['AT key plus another', view('AT-1 APP-2')],
    ['a lowercase key', view('at-1')],
    ['a key with trailing text', view('AT-1; rm -rf /')],
    ['all fields', view('AT-1', '*all')],
    ['other fields', view('AT-1', 'key,description,comment')],
    ['an extra custom field', view('AT-1', `${VIEW_FIELDS},customfield_10000`)],
    ['no --json', ['jira', 'workitem', 'view', 'AT-1', '--fields', VIEW_FIELDS]],
    ['--web', ['jira', 'workitem', 'view', 'AT-1', '--web']],
    ['a trailing flag', [...view('AT-1'), '--web']],
    ['no key', ['jira', 'workitem', 'view', '--fields', VIEW_FIELDS, '--json']],
  ])('blocks a view with %s', (_name, args) => {
    expect(() => assertAllowedAcliCommand(args, settings)).toThrow(/AT-only guard rail/);
  });
});

describe('createJiraClient', () => {
  const review = (key: string, status = 'Review') => ({ key, fields: { summary: `Summary ${key}`, status: { name: status }, assignee: { displayName: 'Brian' } } });

  it('refuses to be built for any project other than AT, or any other target status', () => {
    expect(() => createJiraClient('APP', settings)).toThrow(/restricted to the AT project/);
    expect(() => createJiraClient('MT', settings)).toThrow(/restricted to the AT project/);
    expect(() => createJiraClient('AT', { ...settings, doneStatus: 'In Progress' })).toThrow(/Done or Completed/);
    expect(() => createJiraClient('AT', { ...settings, reviewStatus: 'Review"; DROP' })).toThrow(/JIRA_REVIEW_STATUS/);
  });

  it('lists the review column with the one fixed AT query', async () => {
    const run = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify([review('AT-727'), review('AT-726')])));
    const issues = await createJiraClient('AT', { ...settings, baseUrl: 'https://x.atlassian.net/' }, run).listReviewIssues();

    expect(run).toHaveBeenCalledExactlyOnceWith(search('project = "AT" AND status = "Review" ORDER BY updated DESC'));
    expect(issues).toEqual([
      { key: 'AT-727', summary: 'Summary AT-727', status: 'Review', assignee: 'Brian', reviewers: [], approval: null, reviewInfo: '', recorded: null, url: 'https://x.atlassian.net/browse/AT-727' },
      { key: 'AT-726', summary: 'Summary AT-726', status: 'Review', assignee: 'Brian', reviewers: [], approval: null, reviewInfo: '', recorded: null, url: 'https://x.atlassian.net/browse/AT-726' },
    ]);
  });

  it('drops anything that is not an AT ticket even if acli returned it', async () => {
    const run = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify([review('APP-1'), review('AT-9'), review('MT-3'), { nokey: true }])));
    const issues = await createJiraClient('AT', settings, run).listReviewIssues();
    expect(issues.map((i) => i.key)).toEqual(['AT-9']);
  });

  it('moves a ticket to done only after confirming it is still in review', async () => {
    const run = vi
      .fn<AcliRunner>()
      .mockResolvedValueOnce(ok(JSON.stringify([review('AT-727')])))
      .mockResolvedValueOnce(ok(''));
    await createJiraClient('AT', settings, run).moveReviewIssueToDone('AT-727');

    expect(run.mock.calls.map((c) => c[0])).toEqual([search('key = "AT-727" AND status = "Review"'), transition('AT-727')]);
  });

  it('leaves a ticket alone when it is no longer in review', async () => {
    const run = vi.fn<AcliRunner>().mockResolvedValueOnce(ok('[]'));
    await expect(createJiraClient('AT', settings, run).moveReviewIssueToDone('AT-727')).rejects.toThrow(/not in "Review" any more/);
    expect(run).toHaveBeenCalledTimes(1); // never reached the transition
  });

  it('refuses to move non-AT tickets and never spawns anything', async () => {
    const run = vi.fn<AcliRunner>();
    const jira = createJiraClient('AT', settings, run);
    for (const key of ['APP-1', 'MT-1', 'AT-1,AT-2', 'AT-1; x', '']) {
      await expect(jira.moveReviewIssueToDone(key)).rejects.toThrow(/not a AT ticket key/);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('turns acli failures into actionable messages', async () => {
    const fail = (stderr: string, stdout = ''): AcliRunner => vi.fn().mockResolvedValue({ code: 1, stdout, stderr });
    await expect(createJiraClient('AT', settings, fail('✗ Error: unauthorized: use \'acli auth login\'')).listReviewIssues()).rejects.toThrow(/acli auth login/);
    await expect(createJiraClient('AT', settings, fail('ENOENT spawn acli ENOENT')).listReviewIssues()).rejects.toThrow(/was not found/);
    await expect(createJiraClient('AT', settings, fail('boom happened')).listReviewIssues()).rejects.toThrow(/Reading the review column from Jira failed: boom happened/);
    await expect(createJiraClient('AT', settings, fail('')).listReviewIssues()).rejects.toThrow(/failed\.$/);

    const move = vi
      .fn<AcliRunner>()
      .mockResolvedValueOnce(ok(JSON.stringify([review('AT-1')])))
      .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'transition not available' });
    await expect(createJiraClient('AT', settings, move).moveReviewIssueToDone('AT-1')).rejects.toThrow(/Moving AT-1 to Done failed: transition not available/);
  });

  it('rejects output that is not JSON', async () => {
    const run = vi.fn<AcliRunner>().mockResolvedValue(ok('not json'));
    await expect(createJiraClient('AT', settings, run).listReviewIssues()).rejects.toThrow(/expected JSON/);
  });
});

describe('findReviewIssue (read one ticket with its Reviewer)', () => {
  const issue = (over: Record<string, unknown> = {}) => ({
    key: 'AT-728',
    fields: { summary: 'Add coverage', status: { name: 'Review' }, assignee: { displayName: 'Brian Baggs' }, customfield_10550: { displayName: 'Matthew Carabin' }, ...over },
  });

  it('reads the ticket with one call and returns the single Reviewer', async () => {
    const run = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify(issue())));
    const found = await createJiraClient('AT', { ...settings, baseUrl: 'https://x.atlassian.net' }, run).findReviewIssue('AT-728');

    expect(run).toHaveBeenCalledExactlyOnceWith(view('AT-728'));
    expect(found).toEqual({ key: 'AT-728', summary: 'Add coverage', status: 'Review', assignee: 'Brian Baggs', reviewers: ['Matthew Carabin'], approval: null, reviewInfo: '', recorded: null, url: 'https://x.atlassian.net/browse/AT-728' });
  });

  it('also understands the older multi-user form, an unset reviewer, and an unassigned ticket', async () => {
    const multi = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify(issue({ customfield_10550: [{ displayName: 'A' }, { displayName: 'B' }] }))));
    expect((await createJiraClient('AT', settings, multi).findReviewIssue('AT-728'))?.reviewers).toEqual(['A', 'B']);
    const none = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify(issue({ customfield_10550: null, assignee: null }))));
    const found = await createJiraClient('AT', settings, none).findReviewIssue('AT-728');
    expect(found).toMatchObject({ reviewers: [], assignee: null });
    const missing = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify({ key: 'AT-728', fields: { summary: 'x', status: { name: 'Review' } } })));
    expect((await createJiraClient('AT', settings, missing).findReviewIssue('AT-728'))?.reviewers).toEqual([]);
  });

  it('returns null for a ticket that is not in the review column', async () => {
    const run = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify(issue({ status: { name: 'In Progress' } }))));
    expect(await createJiraClient('AT', settings, run).findReviewIssue('AT-728')).toBeNull();
  });

  it('matches the review column name case-insensitively', async () => {
    const run = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify(issue({ status: { name: 'review' } }))));
    expect(await createJiraClient('AT', settings, run).findReviewIssue('AT-728')).not.toBeNull();
  });

  it('returns null when Jira says the ticket does not exist, but surfaces real failures', async () => {
    const gone = vi.fn<AcliRunner>().mockResolvedValue({ code: 1, stdout: '', stderr: 'Issue does not exist or you do not have permission to see it.' });
    expect(await createJiraClient('AT', settings, gone).findReviewIssue('AT-999')).toBeNull();
    const auth = vi.fn<AcliRunner>().mockResolvedValue({ code: 1, stdout: '', stderr: "unauthorized: use 'acli auth login'" });
    await expect(createJiraClient('AT', settings, auth).findReviewIssue('AT-728')).rejects.toMatchObject({ kind: 'not-authenticated' });
    const boom = vi.fn<AcliRunner>().mockResolvedValue({ code: 1, stdout: '', stderr: 'boom' });
    await expect(createJiraClient('AT', settings, boom).findReviewIssue('AT-728')).rejects.toThrow(/Reading AT-728 from Jira failed/);
  });

  it('rejects output that is not JSON, and an issue with the wrong key', async () => {
    await expect(createJiraClient('AT', settings, vi.fn<AcliRunner>().mockResolvedValue(ok('nope'))).findReviewIssue('AT-728')).rejects.toThrow(/expected JSON/);
    const other = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify(issue({}) && { key: 'AT-1', fields: { status: { name: 'Review' } } })));
    expect(await createJiraClient('AT', settings, other).findReviewIssue('AT-728')).toBeNull();
    const array = vi.fn<AcliRunner>().mockResolvedValue(ok(JSON.stringify([issue()])));
    expect(await createJiraClient('AT', settings, array).findReviewIssue('AT-728')).not.toBeNull();
  });

  it('never spawns anything for a key outside the AT project', async () => {
    const run = vi.fn<AcliRunner>();
    for (const key of ['APP-1', 'MT-2', 'AT-1,AT-2', '']) {
      await expect(createJiraClient('AT', settings, run).findReviewIssue(key)).rejects.toThrow(/not a AT ticket key/);
    }
    expect(run).not.toHaveBeenCalled();
  });
});

describe('acli errors never leak a credential', () => {
  it('redacts tokens and credentialed URLs from the failure message', async () => {
    const leak = ['ATA', 'TT3xFfGF0abcdefghijklmnop12345'].join('');
    const run = vi.fn<AcliRunner>().mockResolvedValue({ code: 1, stdout: '', stderr: `request to ${['https:', '//u:', 'pw123', '@x.atlassian.net'].join('')} failed with token=${leak}` });
    const err = await createJiraClient('AT', settings, run).listReviewIssues().catch((e) => e);
    expect(err).toBeInstanceOf(AcliError);
    expect(err.message).not.toContain(leak);
    expect(err.message).not.toContain('pw123');
    expect(err.message).toContain('[redacted]');
  });
});

describe('parseIssues', () => {
  it('accepts an { issues: [] } wrapper, string statuses and missing fields', () => {
    const out = parseIssues(JSON.stringify({ issues: [{ key: 'AT-5', status: 'Review' }] }), { reviewStatus: 'Review' });
    expect(out).toEqual([{ key: 'AT-5', summary: '', status: 'Review', assignee: null, reviewers: [], approval: null, reviewInfo: '', recorded: null, url: null }]);
    expect(parseIssues('{}', { reviewStatus: 'Review' })).toEqual([]);
  });
});

describe('AT-only guard rail: no Jira field is ever written (only the description gets a review appended)', () => {
  // acli's edit command only takes assignee, description, labels, summary and type: it cannot set the Approval
  // checkboxes (`json: unknown field "customfield_10650"`), so the app records a decision in the description instead.
  it.each([
    ['a payload file that is not the app\'s own temporary file', ['jira', 'workitem', 'edit', '--from-json', '/tmp/review-jira-x/edit.json', '--yes']],
    ['edit by key', ['jira', 'workitem', 'edit', '--key', 'AT-1', '--summary', 'x', '--yes']],
    ['edit labels', ['jira', 'workitem', 'edit', '--key', 'AT-1', '--labels', 'approved', '--yes']],
    ['edit by JQL', ['jira', 'workitem', 'edit', '--jql', 'project = AT', '--summary', 'x', '--yes']],
    ['edit assignee', ['jira', 'workitem', 'edit', '--key', 'AT-1', '--assignee', '@me']],
    ['comment', ['jira', 'workitem', 'comment', 'create', '--key', 'AT-1', '--body', 'Approved']],
    ['link', ['jira', 'workitem', 'link', 'create', '--out', 'AT-1', '--in', 'AT-2']],
  ])('blocks %s', (_name, args) => {
    expect(() => assertAllowedAcliCommand(args, settings)).toThrow(/AT-only guard rail/);
  });

  it('the Jira client can read tickets, append a review to one description, and move one to done: nothing else', () => {
    const client = createJiraClient('AT', settings, async () => ({ code: 0, stdout: '[]', stderr: '' }));
    expect(Object.keys(client).sort()).toEqual(['findReviewIssue', 'listReviewIssues', 'moveReviewIssueToDone', 'recordReview']);
  });

  it('the longest Review Information the app records itself is bounded', () => {
    expect(MAX_REVIEW_INFO_CHARS).toBe(5000);
  });
});

describe('Approval / Review Information parsing', () => {
  it('reads the Approval checkboxes (Declined wins, so it can never unlock a merge)', () => {
    expect(parseApproval([{ value: 'Approved', id: '10478' }])).toBe('approved');
    expect(parseApproval([{ value: 'Declined', id: '10479' }])).toBe('declined');
    expect(parseApproval([{ value: 'Approved', id: '10478' }, { value: 'Declined', id: '10479' }])).toBe('declined');
    expect(parseApproval([{ id: '10478' }])).toBe('approved');
    expect(parseApproval({ value: 'Approved' })).toBe('approved');
    expect(parseApproval(['Approved'])).toBe('approved');
    for (const none of [null, undefined, [], [{ value: 'Something else' }], 'x', 5]) expect(parseApproval(none)).toBeNull();
  });

  it('reads Atlassian Document Format text (paragraphs joined with newlines)', () => {
    expect(
      fromAdf({
        type: 'doc',
        version: 1,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
          { type: 'paragraph', content: [] },
          { type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
        ],
      }),
    ).toBe('one\n\nthree');
    expect(fromAdf('plain string')).toBe('plain string');
    expect(fromAdf(null)).toBe('');
    expect(fromAdf({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }] })).toBe('ab');
  });

  it('parses approval and review information from a ticket', () => {
    const out = parseIssues(
      JSON.stringify([{ key: 'AT-726', fields: { summary: 's', status: { name: 'Review' }, customfield_10650: [{ value: 'Declined', id: '10479' }], customfield_10652: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Needs a cleanup step' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'and a tag' }] }] } } }]),
      { reviewStatus: 'Review' },
    );
    expect(out[0]).toMatchObject({ approval: 'declined', reviewInfo: 'Needs a cleanup step\nand a tag' });
  });
});

// ---------------------------------------------------------------------------------------------------
// Recording a review in the description: append only, never replace what is there.
// ---------------------------------------------------------------------------------------------------

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });
const EXISTING = doc(
  para('Add specs for recurring task comments. Steps to reproduce are below.'),
  { type: 'bulletList', content: [{ type: 'listItem', content: [para('admin')] }, { type: 'listItem', content: [para('member')] }] },
  { type: 'codeBlock', attrs: { language: 'ruby' }, content: [{ type: 'text', text: 'task = Task.find(1)' }] },
);

/** A stand-in for Jira behind acli: it holds the ticket's description, shows it on `view`, and replaces it on `edit`. */
function fakeJira(initial: unknown, hooks: { onEdit?: (desc: Record<string, unknown>) => Record<string, unknown>; status?: string } = {}) {
  const state = { description: initial as unknown, edits: [] as Array<Record<string, unknown>>, calls: [] as string[][] };
  const runner: AcliRunner = async (args) => {
    state.calls.push(args);
    if (args[2] === 'view') {
      const fields: Record<string, unknown> = { summary: 'Add specs', status: { name: hooks.status ?? 'Review' }, assignee: { displayName: 'Brian' }, description: state.description };
      return { code: 0, stdout: JSON.stringify({ key: args[3], fields }), stderr: '' };
    }
    if (args[2] === 'edit') {
      const payload = JSON.parse(readFileSync(args[4], 'utf8')) as { issues: string[]; description: Record<string, unknown> };
      state.edits.push(payload);
      state.description = hooks.onEdit ? hooks.onEdit(payload.description) : payload.description;
      return { code: 0, stdout: '✓ Work item updated', stderr: '' };
    }
    return { code: 1, stdout: '', stderr: 'unexpected' };
  };
  return { state, client: createJiraClient('AT', settings, runner) };
}

const leftoverDirs = () => readdirSync(tmpdir()).filter((n) => join(tmpdir(), n).startsWith(REVIEW_EDIT_DIR_PREFIX));

describe('recordReview: the existing description is never replaced, a review is appended after it', () => {
  it('keeps every word that is already there, byte for byte, and adds a green Approved panel after it with the commit and the note', async () => {
    const { state, client } = fakeJira(EXISTING);

    const issue = await client.recordReview('AT-727', 'approved', 'Covers admin and member.\nOwner is still missing.', SHA_A);

    const written = state.description as { content: Array<Record<string, unknown>> };
    expect(written.content).toHaveLength(EXISTING.content.length + 1);
    expect(written.content.slice(0, EXISTING.content.length)).toEqual(EXISTING.content); // untouched
    const panel = written.content[written.content.length - 1] as { type: string; attrs: { panelType: string }; content: unknown[] };
    expect(panel).toMatchObject({ type: 'panel', attrs: { panelType: 'success' } });
    expect(panel.content.map((p) => fromAdf(p))).toEqual([
      expect.stringMatching(/^Code review: Approved \(recorded by the Review tab on \d{4}-\d{2}-\d{2}\)$/),
      `Commit: ${SHA_A}`,
      'Review notes:',
      'Covers admin and member.',
      'Owner is still missing.',
    ]);
    expect(issue.recorded).toEqual({ decision: 'approved', sha: SHA_A, info: 'Covers admin and member.\nOwner is still missing.' });
    expect(state.edits).toHaveLength(1);
    expect(state.edits[0].issues).toEqual(['AT-727']);
  });

  it('works on an empty description too', async () => {
    const { state, client } = fakeJira(null);
    await client.recordReview('AT-727', 'approved', '', SHA_A);
    const written = state.description as { type: string; content: Array<{ type: string }> };
    expect(written.type).toBe('doc');
    expect(written.content.map((n) => n.type)).toEqual(['panel']);
  });

  it('a later decision is appended too: the earlier panels stay as a history, and the newest one counts', async () => {
    const { state, client } = fakeJira(EXISTING);
    await client.recordReview('AT-727', 'approved', 'Looks good', SHA_A);
    const issue = await client.recordReview('AT-727', 'declined', 'The owner spec is flaky', SHA_B);

    const written = state.description as { content: Array<Record<string, unknown>> };
    expect(written.content).toHaveLength(EXISTING.content.length + 2);
    expect(written.content.slice(0, EXISTING.content.length)).toEqual(EXISTING.content);
    const text = fromAdf({ type: 'doc', content: written.content });
    expect(text).toContain('Code review: Approved');
    expect(text).toContain('Looks good');
    expect(text).toContain('Code review: Changes requested');
    expect(text).toContain('The owner spec is flaky');
    expect(issue.recorded).toEqual({ decision: 'declined', sha: SHA_B, info: 'The owner spec is flaky' });
    expect((written.content[written.content.length - 1] as { attrs: { panelType: string } }).attrs.panelType).toBe('warning');
  });

  it('withdrawing a decision appends a Withdrawn panel (nothing is deleted), and no decision counts afterwards', async () => {
    const { state, client } = fakeJira(EXISTING);
    await client.recordReview('AT-727', 'approved', 'Looks good', SHA_A);
    const issue = await client.recordReview('AT-727', 'none', undefined, SHA_A);

    const written = state.description as { content: Array<Record<string, unknown>> };
    expect(written.content).toHaveLength(EXISTING.content.length + 2);
    expect(fromAdf({ type: 'doc', content: written.content })).toContain('Code review: Approved'); // the history is still there
    expect(fromAdf(written.content[written.content.length - 1])).toContain('Code review: Withdrawn');
    expect(issue.recorded).toBeNull();
  });

  it('does not touch Jira to repeat the same decision, or to withdraw one that is not there', async () => {
    const { state, client } = fakeJira(EXISTING);
    await client.recordReview('AT-727', 'approved', 'Looks good', SHA_A);
    const edits = state.edits.length;
    await client.recordReview('AT-727', 'approved', 'Looks good', SHA_A); // identical
    expect(state.edits).toHaveLength(edits);

    const other = fakeJira(EXISTING);
    await other.client.recordReview('AT-727', 'none', undefined, SHA_A); // nothing to withdraw
    expect(other.state.edits).toHaveLength(0);
  });

  it('is not fooled by Jira tidying the description (extra ids on nodes): that is not a change to what was there', async () => {
    const addIds = (d: Record<string, unknown>) => JSON.parse(JSON.stringify(d), (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) && v.type === 'paragraph' ? { ...v, attrs: { localId: 'x' } } : v));
    const { client } = fakeJira(EXISTING, { onEdit: addIds });
    await expect(client.recordReview('AT-727', 'approved', 'ok', SHA_A)).resolves.toMatchObject({ recorded: { decision: 'approved' } });
  });

  it('puts the description back, and says where the original copy is, if Jira dropped any of the existing text', async () => {
    const dropFirstParagraph = (d: Record<string, unknown>) => ({ ...d, content: (d.content as unknown[]).slice(1) });
    const { state, client } = fakeJira(EXISTING, { onEdit: dropFirstParagraph });
    let calls = 0;
    const originalEdit = state.edits;
    void originalEdit;

    const err = await client.recordReview('AT-727', 'approved', 'ok', SHA_A).catch((e) => e);

    expect(err).toBeInstanceOf(AcliError);
    expect(err.message).toMatch(/did not keep the review as written on AT-727, so its description was put back\. A copy of the original is at /);
    expect(state.edits.length).toBe(2); // the write, then the restore of the original
    expect(state.edits[1].description).toEqual(EXISTING);
    const backup = /A copy of the original is at (\S+)\./.exec(err.message)![1];
    expect(dirname(backup)).toBe(REVIEW_BACKUP_DIR);
    expect(JSON.parse(readFileSync(backup, 'utf8')).content).toEqual(EXISTING.content);
    rmSync(backup, { force: true });
    calls++;
    expect(calls).toBe(1);
  });

  it('puts the description back if the new panel did not make it in', async () => {
    const stripPanels = (d: Record<string, unknown>) => ({ ...d, content: (d.content as Array<{ type: string }>).filter((n) => n.type !== 'panel') });
    const { state, client } = fakeJira(EXISTING, { onEdit: stripPanels });
    const err = await client.recordReview('AT-727', 'approved', 'ok', SHA_A).catch((e) => e);
    expect(err.message).toMatch(/put back/);
    expect(state.edits[state.edits.length - 1].description).toEqual(EXISTING);
    const backup = /at (\S+)\./.exec(err.message)![1];
    rmSync(backup, { force: true });
  });

  it('never rewrites a description that has images or macros, and says so, without running any edit', async () => {
    for (const unsafe of ['mediaSingle', 'mediaGroup', 'extension', 'bodiedExtension', 'inlineExtension']) {
      const withUnsafe = doc(para('Screenshot below'), { type: unsafe, content: [] });
      const { state, client } = fakeJira(withUnsafe);
      const err = await client.recordReview('AT-727', 'approved', 'ok', SHA_A).catch((e) => e);
      expect(err).toMatchObject({ kind: 'unsupported' });
      expect(err.message).toMatch(/images or macros/);
      expect(state.edits).toHaveLength(0);
    }
  });

  it('refuses a ticket that is not in the review column, and anything outside AT, without editing', async () => {
    const out = fakeJira(EXISTING, { status: 'In Progress' });
    await expect(out.client.recordReview('AT-727', 'approved', 'ok', SHA_A)).rejects.toThrow(/not in "Review" any more/);
    expect(out.state.edits).toHaveLength(0);
    const { client } = fakeJira(EXISTING);
    await expect(client.recordReview('APP-1', 'approved', 'ok', SHA_A)).rejects.toThrow(/not a AT ticket key/);
    await expect(client.recordReview('AT-1,AT-2', 'approved', 'ok', SHA_A)).rejects.toThrow(/not a AT ticket key/);
  });

  it('needs the reviewed commit, bounds the note, and strips control characters', async () => {
    const { state, client } = fakeJira(EXISTING);
    await expect(client.recordReview('AT-727', 'approved', 'ok', 'abc')).rejects.toThrow(/commit that was reviewed is needed/);
    await expect(client.recordReview('AT-727', 'declined', 'x'.repeat(MAX_REVIEW_INFO_CHARS + 1), SHA_A)).rejects.toThrow(/limited to 5000/);
    expect(state.edits).toHaveLength(0);
    await client.recordReview('AT-727', 'declined', 'bad\0 char\r\nnext', SHA_A);
    const text = fromAdf(state.description);
    expect(text).toContain('bad char');
    expect(text).not.toContain('\0');
  });

  it('removes its temporary edit file every time, and leaves no backup when everything worked', async () => {
    const before = leftoverDirs().length;
    const backups = existsSync(REVIEW_BACKUP_DIR) ? readdirSync(REVIEW_BACKUP_DIR).length : 0;
    const { client } = fakeJira(EXISTING);
    await client.recordReview('AT-727', 'approved', 'ok', SHA_A);
    expect(leftoverDirs().length).toBe(before);
    expect(existsSync(REVIEW_BACKUP_DIR) ? readdirSync(REVIEW_BACKUP_DIR).length : 0).toBe(backups);
  });

  it('when acli itself refuses the edit nothing changed: the error is clear, and the temp file and the backup are gone', async () => {
    const before = leftoverDirs().length;
    const backups = existsSync(REVIEW_BACKUP_DIR) ? readdirSync(REVIEW_BACKUP_DIR).length : 0;
    const runner: AcliRunner = async (args) => {
      if (args[2] === 'view') return { code: 0, stdout: JSON.stringify({ key: 'AT-727', fields: { summary: 's', status: { name: 'Review' }, description: EXISTING } }), stderr: '' };
      return { code: 1, stdout: '', stderr: '✗ Error: you do not have permission to edit this work item' };
    };
    const client = createJiraClient('AT', settings, runner);
    await expect(client.recordReview('AT-727', 'approved', 'ok', SHA_A)).rejects.toThrow(/Saving the review on AT-727 failed/);
    expect(leftoverDirs().length).toBe(before);
    expect(existsSync(REVIEW_BACKUP_DIR) ? readdirSync(REVIEW_BACKUP_DIR).length : 0).toBe(backups);
  });
});

describe('the edit payload guard', () => {
  const dir = mkdtempSync(REVIEW_EDIT_DIR_PREFIX);
  const file = join(dir, 'edit.json');
  const edit = (payload: unknown) => {
    writeFileSync(file, JSON.stringify(payload));
    return ['jira', 'workitem', 'edit', '--from-json', file, '--yes'];
  };
  const good = () => ({ issues: ['AT-727'], description: appendReviewPanel({ type: 'doc', content: [para('hi')] } as never, buildReviewPanel('approved', 'ok', SHA_A, new Date())) });

  it('allows exactly one AT ticket and its description document', () => {
    expect(() => assertAllowedAcliCommand(edit(good()), settings)).not.toThrow();
    expect(() => assertReviewEditPayload(good())).not.toThrow();
    expect(() => assertReviewEditPayload({ issues: ['AT-727'], description: { type: 'doc', content: [] } })).not.toThrow();
  });

  it.each([
    ['the approval custom field', { ...good(), customfield_10650: [{ id: '10478' }] }],
    ['other standard fields', { ...good(), summary: 'x' }],
    ['labels', { ...good(), labelsToAdd: ['approved'] }],
    ['an assignee', { ...good(), assignee: 'x@example.com' }],
    ['a type change', { ...good(), type: 'Bug' }],
    ['additional attributes', { ...good(), additionalAttributes: { customfield_10650: 1 } }],
    ['no description', { issues: ['AT-727'] }],
    ['no issues', { description: good().description }],
    ['two tickets', { ...good(), issues: ['AT-1', 'AT-2'] }],
    ['a ticket from another project', { ...good(), issues: ['APP-1'] }],
    ['a lowercase key', { ...good(), issues: ['at-1'] }],
    ['a description that is not a document', { ...good(), description: 'plain text' }],
    ['a document with a bad node', { ...good(), description: { type: 'doc', content: [42] } }],
    ['an image', { ...good(), description: { type: 'doc', content: [{ type: 'mediaSingle', content: [] }] } }],
    ['a macro', { ...good(), description: { type: 'doc', content: [{ type: 'extension' }] } }],
    ['a huge description', { ...good(), description: { type: 'doc', content: [para('x'.repeat(400_000))] } }],
    ['an array instead of an object', [good()]],
  ])('blocks %s', (_name, payload) => {
    expect(() => assertAllowedAcliCommand(edit(payload), settings)).toThrow(/AT-only guard rail/);
  });

  it.each([
    ['extra flags', (f: string) => ['jira', 'workitem', 'edit', '--from-json', f, '--yes', '--ignore-errors']],
    ['no --yes', (f: string) => ['jira', 'workitem', 'edit', '--from-json', f]],
    ['a key instead of a file', () => ['jira', 'workitem', 'edit', '--key', 'AT-1', '--description', 'x', '--yes']],
    ['a file outside the private temp directory', () => ['jira', 'workitem', 'edit', '--from-json', '/etc/passwd', '--yes']],
    ['a path that climbs out', () => ['jira', 'workitem', 'edit', '--from-json', `${dir}/../../etc/passwd`, '--yes']],
    ['a file that is not there', () => ['jira', 'workitem', 'edit', '--from-json', join(dir, 'missing.json'), '--yes']],
  ])('blocks %s', (_name, build) => {
    writeFileSync(file, JSON.stringify(good()));
    expect(() => assertAllowedAcliCommand(build(file), settings)).toThrow(/AT-only guard rail/);
  });

  it('cleans up', () => {
    rmSync(dir, { recursive: true, force: true });
    expect(existsSync(dir)).toBe(false);
  });
});

describe('parseReviewPanel (what a description says about the review)', () => {
  const panel = (decision: 'approved' | 'declined' | 'withdrawn', info: string, sha: string) => buildReviewPanel(decision, info, sha, new Date('2026-11-06T00:00:00Z'));

  it('reads the newest panel, so a history of decisions ends in the latest one', () => {
    const history = doc(para('text'), panel('approved', 'first', SHA_A), panel('declined', 'second\nline', SHA_B));
    expect(parseReviewPanel(history)).toEqual({ decision: 'declined', sha: SHA_B, info: 'second\nline' });
  });

  it('still understands the label an early version wrote ("Declined") as changes requested', () => {
    const old = { type: 'panel', attrs: { panelType: 'error' }, content: [para('Code review: Declined (recorded by the Review tab on 2026-11-06)'), para(`Commit: ${SHA_A}`), para('Review notes:'), para('Please fix the selector')] };
    expect(parseReviewPanel(doc(old))).toEqual({ decision: 'declined', sha: SHA_A, info: 'Please fix the selector' });
  });

  it('a Withdrawn panel as the newest means no decision', () => {
    expect(parseReviewPanel(doc(panel('approved', '', SHA_A), panel('withdrawn', '', SHA_A)))).toBeNull();
    expect(parseReviewPanel(doc(panel('withdrawn', '', SHA_A), panel('approved', 'again', SHA_B)))).toMatchObject({ decision: 'approved', sha: SHA_B });
  });

  it.each([
    ['no description', null],
    ['a description without a review', doc(para('Code review notes are in the wiki'))],
    ['someone writing "Code review: Approved" in an ordinary paragraph', doc(para('Code review: Approved'))],
    ['a panel that is not ours', doc({ type: 'panel', attrs: { panelType: 'info' }, content: [para('Heads up')] })],
    ['a damaged panel (no commit line)', doc({ type: 'panel', attrs: { panelType: 'success' }, content: [para('Code review: Approved')] })],
    ['a damaged panel (not a full commit id)', doc({ type: 'panel', attrs: { panelType: 'success' }, content: [para('Code review: Approved'), para('Commit: abc123')] })],
    ['text that is not a document', 'Code review: Approved'],
  ])('finds nothing in %s', (_name, input) => {
    expect(parseReviewPanel(input)).toBeNull();
  });
});
