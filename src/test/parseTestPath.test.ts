import { describe, it, expect } from 'vitest';
import { parseTestPath, getUniqueValues } from '../utils/parseTestPath';

describe('parseTestPath', () => {
  it('should parse valid e2e test paths', () => {
    const result = parseTestPath('e2e/user_management/login_page/admin');
    expect(result).toEqual({
      module: 'user management',
      page: 'login page',
      accountType: 'admin',
      fullPath: 'e2e/user_management/login_page/admin'
    });
  });

  it('should parse test paths with multiple underscores', () => {
    const result = parseTestPath('e2e/order_management_system/checkout_flow_page/premium_user');
    expect(result).toEqual({
      module: 'order management system',
      page: 'checkout flow page',
      accountType: 'premium_user',
      fullPath: 'e2e/order_management_system/checkout_flow_page/premium_user'
    });
  });

  it('should parse paths with additional segments', () => {
    const result = parseTestPath('e2e/billing/invoice/standard/test1');
    expect(result).toEqual({
      module: 'billing',
      page: 'invoice',
      accountType: 'standard',
      fullPath: 'e2e/billing/invoice/standard/test1'
    });
  });

  it('should return null for invalid paths', () => {
    expect(parseTestPath('unit/user/login')).toBeNull();
    expect(parseTestPath('e2e/user/login')).toBeNull();
    expect(parseTestPath('e2e')).toBeNull();
    expect(parseTestPath('')).toBeNull();
    expect(parseTestPath('integration/test/path/account')).toBeNull();
  });

  it('should return null for paths with less than 4 segments', () => {
    expect(parseTestPath('e2e/user/login')).toBeNull();
    expect(parseTestPath('e2e/user')).toBeNull();
    expect(parseTestPath('e2e')).toBeNull();
  });
});

describe('getUniqueValues', () => {
  const mockTests = [
    { name: 'e2e/user_management/login_page/admin' },
    { name: 'e2e/user_management/profile_page/admin' },
    { name: 'e2e/billing/invoice_page/standard' },
    { name: 'e2e/billing/payment_page/premium' },
    { name: 'e2e/order_management/checkout/admin' },
    { name: 'invalid/path/test' }, // Should be ignored
    { name: 'unit/test' }, // Should be ignored
  ];

  it('should extract unique modules', () => {
    const modules = getUniqueValues(mockTests, 'module');
    expect(modules).toEqual(['billing', 'order management', 'user management']);
  });

  it('should extract unique pages', () => {
    const pages = getUniqueValues(mockTests, 'page');
    expect(pages).toEqual(['checkout', 'invoice page', 'login page', 'payment page', 'profile page']);
  });

  it('should extract unique account types', () => {
    const accountTypes = getUniqueValues(mockTests, 'accountType');
    expect(accountTypes).toEqual(['admin', 'premium', 'standard']);
  });

  it('should handle empty array', () => {
    expect(getUniqueValues([], 'module')).toEqual([]);
    expect(getUniqueValues([], 'page')).toEqual([]);
    expect(getUniqueValues([], 'accountType')).toEqual([]);
  });

  it('should handle tests with no valid paths', () => {
    const invalidTests = [
      { name: 'invalid/path' },
      { name: 'unit/test' },
      { name: 'not/e2e/path' }
    ];
    expect(getUniqueValues(invalidTests, 'module')).toEqual([]);
    expect(getUniqueValues(invalidTests, 'page')).toEqual([]);
    expect(getUniqueValues(invalidTests, 'accountType')).toEqual([]);
  });
});