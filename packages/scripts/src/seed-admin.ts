import { Resource } from 'sst';

async function seedAdmin() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;

  const { Auth, User } = await import('@rasika/core');

  const email = process.argv[2];

  if (!email) {
    console.error('Usage: pnpm seed:admin <user-email>');
    console.error('Example: pnpm seed:admin admin@example.com');
    process.exit(1);
  }

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

seedAdmin().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
