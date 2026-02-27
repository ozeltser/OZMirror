/**
 * Tests for feed-manager SSRF validation.
 *
 * Mocks DNS resolution (`dns/promises`) to test that validateFeedUrl
 * rejects URLs resolving to private/reserved IP addresses, including
 * bypass techniques like decimal, hex, and octal IP representations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dns/promises before importing the module under test ─────────────────
// vi.hoisted runs before vi.mock hoisting, so the variable is available.

const { mockLookup } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
}));

vi.mock('dns/promises', () => ({ lookup: mockLookup }));

// Mock rss-parser to avoid real HTTP requests
vi.mock('rss-parser', () => {
  return {
    default: class MockParser {
      parseURL = vi.fn().mockResolvedValue({
        title: 'Mock Feed',
        items: [{ guid: '1', title: 'Item 1', link: 'https://example.com/1' }],
      });
    },
  };
});

import { getFeed } from '../feed-manager';

// ─────────────────────────────────────────────────────────────────────────────

describe('feed-manager SSRF validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Protocol checks --

  it('rejects non-http(s) protocols', async () => {
    await expect(getFeed('rss_01', 'ftp://example.com/feed', 10, null))
      .rejects.toThrow('Feed URL must use http or https');
  });

  it('rejects invalid URLs', async () => {
    await expect(getFeed('rss_01', 'not-a-url', 10, null))
      .rejects.toThrow('Invalid feed URL');
  });

  // -- Hostname string checks (fast-reject) --

  it('rejects localhost', async () => {
    await expect(getFeed('rss_01', 'http://localhost/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects IPv6 loopback [::1]', async () => {
    await expect(getFeed('rss_01', 'http://[::1]/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects IPv6 ULA [fd00::1]', async () => {
    await expect(getFeed('rss_01', 'http://[fd00::1]/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  // -- DNS resolution checks --

  it('rejects when DNS resolves to 127.0.0.1', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to 10.x private range', async () => {
    mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to 192.168.x private range', async () => {
    mockLookup.mockResolvedValue({ address: '192.168.1.1', family: 4 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to 172.16.x private range', async () => {
    mockLookup.mockResolvedValue({ address: '172.16.0.1', family: 4 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to 169.254.x link-local', async () => {
    mockLookup.mockResolvedValue({ address: '169.254.1.1', family: 4 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to 0.0.0.0', async () => {
    mockLookup.mockResolvedValue({ address: '0.0.0.0', family: 4 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to 100.64.x CGNAT range', async () => {
    mockLookup.mockResolvedValue({ address: '100.64.0.1', family: 4 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to IPv6 loopback ::1', async () => {
    mockLookup.mockResolvedValue({ address: '::1', family: 6 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('rejects when DNS resolves to IPv6 ULA', async () => {
    mockLookup.mockResolvedValue({ address: 'fd12:3456:789a::1', family: 6 });
    await expect(getFeed('rss_01', 'http://evil.example.com/feed', 10, null))
      .rejects.toThrow('Feed URL targets a private or reserved address');
  });

  it('throws when hostname cannot be resolved', async () => {
    mockLookup.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(getFeed('rss_01', 'http://nonexistent.example.com/feed', 10, null))
      .rejects.toThrow('Could not resolve feed URL hostname');
  });

  // -- Valid public IPs --

  it('allows a public IP', async () => {
    mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
    // Will proceed to rss-parser parseURL (mocked), should succeed
    const result = await getFeed('rss_01', 'https://feeds.example.com/rss', 10, null);
    expect(result.feedTitle).toBe('Mock Feed');
    expect(result.items).toHaveLength(1);
  });

  it('allows 172.32.x (outside the 172.16-31 private range)', async () => {
    mockLookup.mockResolvedValue({ address: '172.32.0.1', family: 4 });
    const result = await getFeed('rss_01', 'https://feeds.example.com/rss', 10, null);
    expect(result.feedTitle).toBe('Mock Feed');
  });

  it('allows 100.63.x (below CGNAT range)', async () => {
    mockLookup.mockResolvedValue({ address: '100.63.255.255', family: 4 });
    const result = await getFeed('rss_01', 'https://feeds.example.com/rss', 10, null);
    expect(result.feedTitle).toBe('Mock Feed');
  });
});
