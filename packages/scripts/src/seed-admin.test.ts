import * as Auth from '@rasika/core/auth';
import * as User from '@rasika/core/domain/user';
import { describe, expect, it } from 'vitest';

describe('seed-admin', () => {
  it('should promote user to admin', async () => {
    const email = 'tejovanth.n@gmail.com';

    const user = await User.getUserByEmail(email);

    if (!user) {
      console.log(`User with email ${email} not found - skipping test`);
      return;
    }

    console.log(`Found user: ${user.name} (${user.id})`);
    console.log(`Current role: ${user.role}`);

    const updatedUser = await User.updateUserRole(user.id, Auth.ROLE.ADMIN);

    console.log(`Role updated to: ${updatedUser.role}`);

    expect(updatedUser.role).toBe(Auth.ROLE.ADMIN);
  });
});
