import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const targetEmails = [
  'sairishitsunku@gmail.com',
  'indranidebnathroy2024@gmail.com',
  'ipshitaroy2019@gmail.com'
].map(e => e.toLowerCase().trim());

async function main() {
  console.log('Searching for users matching target emails...');
  
  // Find all users
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      name: true,
      role: true
    }
  });

  console.log(`Total users found: ${allUsers.length}`);

  for (const user of allUsers) {
    const userEmail = (user.email || '').toLowerCase().trim();
    const shouldBeAdmin = targetEmails.includes(userEmail);
    
    if (shouldBeAdmin) {
      console.log(`Setting ADMIN role for: ${user.email} (ID: ${user.id}, Name: ${user.name || 'N/A'})`);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' }
      });
    } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      console.log(`Demoting non-target admin user to USER: ${user.email || user.phoneNumber} (ID: ${user.id})`);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'USER' }
      });
    }
  }

  // Check which target emails were found
  const updatedAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, phoneNumber: true, name: true, role: true }
  });

  console.log('\nCurrent Admin Accounts:');
  console.log(JSON.stringify(updatedAdmins, null, 2));

  for (const email of targetEmails) {
    const found = updatedAdmins.some(a => (a.email || '').toLowerCase().trim() === email);
    if (!found) {
      console.warn(`⚠️ Warning: Account with email "${email}" was not found in the database yet. (If they register later, their role can be granted upon registration or manual check).`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Error updating admins:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
