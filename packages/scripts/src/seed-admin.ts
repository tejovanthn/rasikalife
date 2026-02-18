export async function seedAdmin(email: string) {
  const Auth = await import('@rasika/core/auth');
  const User = await import('@rasika/core/domain/user');

  console.log(`Looking for user with email: ${email}`);

  const user = await User.getUserByEmail(email);

  if (!user) {
    console.error(`User with email ${email} not found.`);
    console.error('Make sure the user has logged in at least once.');
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.id})`);
  console.log(`Current role: ${user.role}`);

  const updatedUser = await User.updateUserRole(user.id, Auth.ROLE.ADMIN);

  console.log(`Role updated to: ${updatedUser.role}`);
  console.log('Done!');
}
