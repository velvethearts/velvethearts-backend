import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AI_PROFILE_EMAILS = [
  'ananya.s@example.com',
  'kavya.n@example.com',
  'ria.mehta@example.com',
  'tanya.kapoor@example.com',
  'samyukta.r@example.com',
  'aarav.v@example.com',
  'sid.deshmukh@example.com'
];

const AI_PROFILE_PHONES = [
  '+919876543210',
  '+919876543211',
  '+919876543212',
  '+919876543213',
  '+919876543214',
  '+919876543215',
  '+919876543216'
];

const AI_PROFILE_NAMES = [
  'Ananya Sharma',
  'Kavya Nair',
  'Ria Mehta',
  'Tanya Kapoor',
  'Samyukta Rao',
  'Aarav Verma',
  'Siddharth Deshmukh'
];

async function main() {
  console.log('Searching for AI demo profiles to delete...');

  // Find all users matching these emails, phone numbers, or profile names
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: AI_PROFILE_EMAILS } },
        { phoneNumber: { in: AI_PROFILE_PHONES } },
        { profile: { name: { in: AI_PROFILE_NAMES } } }
      ]
    },
    include: {
      profile: true
    }
  });

  console.log(`Found ${users.length} matching AI users to delete.`);

  for (const user of users) {
    console.log(`Deleting user: ${user.id} (${user.profile?.name || user.email || user.phoneNumber})`);
    
    // Clean up relations where cascade might not be automatic
    await prisma.like.deleteMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }]
      }
    });

    await prisma.match.deleteMany({
      where: {
        OR: [{ user1Id: user.id }, { user2Id: user.id }]
      }
    });

    await prisma.block.deleteMany({
      where: {
        OR: [{ blockerId: user.id }, { blockedId: user.id }]
      }
    });

    await prisma.report.deleteMany({
      where: {
        OR: [{ reporterId: user.id }, { reportedId: user.id }]
      }
    });

    await prisma.conversationParticipant.deleteMany({
      where: { userId: user.id }
    });

    await prisma.message.deleteMany({
      where: { senderId: user.id }
    });

    await prisma.activityLog.deleteMany({
      where: { userId: user.id }
    });

    await prisma.notification.deleteMany({
      where: { userId: user.id }
    });

    // Delete user (cascades profile, photos, settings)
    await prisma.user.delete({
      where: { id: user.id }
    });

    console.log(`Successfully deleted user: ${user.id}`);
  }

  console.log('Finished removing all AI demo profiles from the database!');
}

main()
  .catch((e) => {
    console.error('Error deleting AI profiles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
