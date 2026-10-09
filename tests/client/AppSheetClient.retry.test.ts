/**
 * Test Suite: AppSheetClient - retry policy
 *
 * Verifies that Find is always retried, that mutations keep being retried by
 * default (no behavior change), and that retryWrites: false sends mutations
 * exactly once, because a repeated write after a lost response could create
 * duplicates or apply a change twice.
 *
 * @module tests/client
 */

import axios from 'axios';
import { AppSheetClient } from '../../src/client/AppSheetClient';
import {
  AppSheetError,
  ConnectionDefinition,
  NetworkError,
  ValidationError,
} from '../../src/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockAxiosInstance = { post: jest.fn() };

const baseDefinition: ConnectionDefinition = {
  appId: 'test-app-id',
  applicationAccessKey: 'test-key',
  tables: {},
};

/** Builds an error shaped like an AxiosError. */
function axiosError(options: { status?: number; code?: string; message?: string }): Error {
  const error: any = new Error(options.message ?? 'request failed');
  error.isAxiosError = true;
  error.code = options.code;
  if (options.status !== undefined) {
    error.response = { status: options.status, data: { error: 'server said no' } };
  }
  return error;
}

const serverError = () => axiosError({ status: 500 });
const timeoutError = () =>
  axiosError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' });
const networkError = () => axiosError({ code: 'ECONNRESET', message: 'socket hang up' });

function createClient(overrides: Partial<ConnectionDefinition> = {}): AppSheetClient {
  const client = new AppSheetClient({ ...baseDefinition, ...overrides }, 'user@example.com');
  // Replace the real backoff so tests do not wait 1s/2s.
  jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);
  return client;
}

describe('AppSheetClient - retry policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockedAxios.isAxiosError.mockImplementation((e: any) => !!e && e.isAxiosError === true);
  });

  describe('retryWrites: false sends mutations exactly once', () => {
    const mutations: Array<[string, (client: AppSheetClient) => Promise<unknown>]> = [
      ['add', (c) => c.add({ tableName: 'T', rows: [{ a: 1 }] })],
      ['update', (c) => c.update({ tableName: 'T', rows: [{ id: '1' }] })],
      ['delete', (c) => c.delete({ tableName: 'T', rows: [{ id: '1' }] })],
    ];
    const failures: Array<[string, () => Error, new (...args: any[]) => Error]> = [
      ['HTTP 500', serverError, AppSheetError],
      ['timeout', timeoutError, NetworkError],
      ['network error', networkError, NetworkError],
    ];

    for (const [operation, run] of mutations) {
      for (const [label, makeError, expectedType] of failures) {
        it(`sends ${operation} exactly once on ${label}`, async () => {
          mockAxiosInstance.post.mockRejectedValue(makeError());
          const client = createClient({ retryAttempts: 5, retryWrites: false });

          await expect(run(client)).rejects.toBeInstanceOf(expectedType);

          expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
          expect((client as any).sleep).not.toHaveBeenCalled();
        });
      }
    }

    it('keeps the converted API error for a failed mutation with status 500', async () => {
      mockAxiosInstance.post.mockRejectedValue(serverError());
      const client = createClient({ retryWrites: false });

      await expect(client.add({ tableName: 'T', rows: [{}] })).rejects.toMatchObject({
        code: 'API_ERROR',
        statusCode: 500,
      });
    });
  });

  describe('mutations are retried by default (unchanged behavior)', () => {
    const mutations: Array<[string, (client: AppSheetClient) => Promise<unknown>]> = [
      ['add', (c) => c.add({ tableName: 'T', rows: [{ a: 1 }] })],
      ['update', (c) => c.update({ tableName: 'T', rows: [{ id: '1' }] })],
      ['delete', (c) => c.delete({ tableName: 'T', rows: [{ id: '1' }] })],
    ];

    for (const [operation, run] of mutations) {
      it(`retries ${operation} 3 times by default on HTTP 500`, async () => {
        mockAxiosInstance.post.mockRejectedValue(serverError());
        const client = createClient();

        await expect(run(client)).rejects.toBeInstanceOf(AppSheetError);

        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      });

      it(`retries ${operation} up to retryAttempts when retryWrites is true`, async () => {
        mockAxiosInstance.post.mockRejectedValue(timeoutError());
        const client = createClient({ retryAttempts: 4, retryWrites: true });

        await expect(run(client)).rejects.toBeInstanceOf(NetworkError);

        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4);
      });
    }

    it('does not retry a 4xx mutation even with retries enabled', async () => {
      mockAxiosInstance.post.mockRejectedValue(axiosError({ status: 400 }));
      const client = createClient();

      await expect(client.add({ tableName: 'T', rows: [{}] })).rejects.toBeInstanceOf(
        ValidationError
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('find retries up to retryAttempts', () => {
    it('defaults to 3 attempts in total', async () => {
      mockAxiosInstance.post.mockRejectedValue(serverError());
      const client = createClient();

      await expect(client.find({ tableName: 'T' })).rejects.toBeInstanceOf(AppSheetError);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect((client as any).sleep).toHaveBeenNthCalledWith(1, 1000);
      expect((client as any).sleep).toHaveBeenNthCalledWith(2, 2000);
    });

    it('does not retry when retryAttempts is 1', async () => {
      mockAxiosInstance.post.mockRejectedValue(serverError());
      const client = createClient({ retryAttempts: 1 });

      await expect(client.find({ tableName: 'T' })).rejects.toBeInstanceOf(AppSheetError);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('uses a configured retryAttempts of 5', async () => {
      mockAxiosInstance.post.mockRejectedValue(timeoutError());
      const client = createClient({ retryAttempts: 5 });

      await expect(client.find({ tableName: 'T' })).rejects.toBeInstanceOf(NetworkError);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(5);
    });

    it('caps the backoff delay at 10 seconds', async () => {
      mockAxiosInstance.post.mockRejectedValue(networkError());
      const client = createClient({ retryAttempts: 6 });

      await expect(client.find({ tableName: 'T' })).rejects.toBeInstanceOf(NetworkError);

      const delays = ((client as any).sleep as jest.Mock).mock.calls.map((c) => c[0]);
      expect(delays).toEqual([1000, 2000, 4000, 8000, 10000]);
    });

    it('returns the result once a retry succeeds', async () => {
      mockAxiosInstance.post
        .mockRejectedValueOnce(serverError())
        .mockResolvedValueOnce({ data: { Rows: [{ id: '1' }] } });
      const client = createClient();

      const result = await client.find({ tableName: 'T' });

      expect(result.rows).toEqual([{ id: '1' }]);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('still retries find when retryWrites is false', async () => {
      mockAxiosInstance.post.mockRejectedValue(serverError());
      const client = createClient({ retryWrites: false });

      await expect(client.find({ tableName: 'T' })).rejects.toBeInstanceOf(AppSheetError);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('retries findAll and findOne as they use find internally', async () => {
      mockAxiosInstance.post.mockRejectedValue(serverError());
      const client = createClient({ retryAttempts: 2 });

      await expect(client.findAll('T')).rejects.toBeInstanceOf(AppSheetError);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);

      mockAxiosInstance.post.mockClear();
      await expect(client.findOne('T', '[a] = 1')).rejects.toBeInstanceOf(AppSheetError);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('never retries a 4xx response', async () => {
      mockAxiosInstance.post.mockRejectedValue(axiosError({ status: 400 }));
      const client = createClient({ retryAttempts: 5 });

      await expect(client.find({ tableName: 'T' })).rejects.toBeInstanceOf(ValidationError);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryAttempts validation', () => {
    it.each([0, -1, 1.5, NaN, Infinity])('rejects %p', (value) => {
      expect(() => createClient({ retryAttempts: value })).toThrow(ValidationError);
      expect(() => createClient({ retryAttempts: value })).toThrow(/retryAttempts/);
    });

    it('rejects a non-number value', () => {
      expect(() => createClient({ retryAttempts: '3' as any })).toThrow(ValidationError);
    });

    it.each([1, 3, 10])('accepts %p', (value) => {
      expect(() => createClient({ retryAttempts: value })).not.toThrow();
    });
  });

  describe('retryWrites validation', () => {
    it.each(['false', 0, 1, null])('rejects non-boolean %p', (value) => {
      expect(() => createClient({ retryWrites: value as any })).toThrow(ValidationError);
      expect(() => createClient({ retryWrites: value as any })).toThrow(/retryWrites/);
    });

    it.each([true, false])('accepts %p', (value) => {
      expect(() => createClient({ retryWrites: value })).not.toThrow();
    });
  });
});
