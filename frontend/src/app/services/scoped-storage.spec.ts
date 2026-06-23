import { userScopedKey, migrateGlobalKey, migrateGlobalKeys } from './scoped-storage';

describe('scoped-storage (cross-account isolation)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('namespaces keys per user so accounts never collide', () => {
    expect(userScopedKey('clarity_second_income', 5)).toBe('clarity_second_income__u5');
    expect(userScopedKey('clarity_second_income', 6)).not.toBe(userScopedKey('clarity_second_income', 5));
  });

  it('migrates a legacy global key into the user scope and deletes the global copy', () => {
    localStorage.setItem('clarity_second_income', '{"gross":9999,"net":7000}');
    migrateGlobalKey('clarity_second_income', 5);
    // moved into user 5's scope…
    expect(localStorage.getItem('clarity_second_income__u5')).toBe('{"gross":9999,"net":7000}');
    // …and the global copy is gone so another account can't read it
    expect(localStorage.getItem('clarity_second_income')).toBeNull();
  });

  it('a second user cannot read the first user\'s migrated data', () => {
    localStorage.setItem('clarity_retirement', '{"trad401k":1234}');
    migrateGlobalKeys(['clarity_retirement'], 5);          // user 5 logs in first
    // user 6 reads their own scoped key → nothing
    expect(localStorage.getItem(userScopedKey('clarity_retirement', 6))).toBeNull();
    // and the global key no longer exists to leak
    expect(localStorage.getItem('clarity_retirement')).toBeNull();
  });

  it('does not overwrite an existing scoped value during migration', () => {
    localStorage.setItem('clarity_second_income__u5', '{"gross":1,"net":1}');
    localStorage.setItem('clarity_second_income', '{"gross":2,"net":2}');
    migrateGlobalKey('clarity_second_income', 5);
    expect(localStorage.getItem('clarity_second_income__u5')).toBe('{"gross":1,"net":1}');
    expect(localStorage.getItem('clarity_second_income')).toBeNull();
  });
});
