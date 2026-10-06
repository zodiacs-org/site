import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn(), status: 200, response: '{}', options: undefined as any }));
vi.mock('node:dns/promises', () => ({ lookup: fake.lookup }));
vi.mock('node:https', () => ({ request: fake.request }));
import { callbackPost } from './callback';

beforeEach(() => {
  vi.clearAllMocks(); fake.status = 200; fake.response = '{}';
  fake.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
  fake.request.mockImplementation((_url, options, callback) => {
    fake.options = options;
    const request = new EventEmitter() as any;
    request.end = () => {
      const response = new EventEmitter() as any; response.statusCode = fake.status; response.destroy = vi.fn();
      callback(response);
      queueMicrotask(() => { response.emit('data', Buffer.from(fake.response)); response.emit('end'); });
    };
    return request;
  });
});

describe('Sky Watch outbound connection boundary', () => {
  it('pins the validated address and retains the hostname for TLS; resolves anew each time', async () => {
    await callbackPost('https://receiver.example/events', {}, '{}');
    expect(fake.options.servername).toBe('receiver.example'); expect(fake.options.agent).toBe(false);
    const received = vi.fn(); fake.options.lookup('receiver.example', {}, received);
    expect(received).toHaveBeenCalledWith(null, '8.8.8.8', 4);
    fake.lookup.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    await expect(callbackPost('https://receiver.example/events', {}, '{}')).rejects.toThrow('blocked');
    expect(fake.request).toHaveBeenCalledTimes(1);
    expect(fake.lookup).toHaveBeenCalledTimes(2);
  });
  it('refuses mixed public/private DNS answers and limits both request and response bytes', async () => {
    fake.lookup.mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }, { address: '169.254.169.254', family: 4 }]);
    await expect(callbackPost('https://receiver.example', {}, '{}')).rejects.toThrow();
    expect(fake.request).not.toHaveBeenCalled();
    await expect(callbackPost('https://receiver.example', {}, 'a'.repeat(262145))).rejects.toThrow('payload-too-large');
    fake.response = 'a'.repeat(4097);
    await expect(callbackPost('https://receiver.example', {}, '{}')).rejects.toThrow('response-too-large');
  });
  it('returns redirects as a failure without following Location', async () => {
    fake.status = 302;
    expect((await callbackPost('https://receiver.example', {}, '{}')).status).toBe(302);
    expect(fake.request).toHaveBeenCalledTimes(1);
  });
});
