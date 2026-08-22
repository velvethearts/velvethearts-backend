const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function triggerDelivery() {
  console.log('--- Fast-forwarding Sealed Rewind Letters ---');
  
  // Set all SEALED letters deliverAfter date to 1 hour ago
  const pastDate = new Date();
  pastDate.setHours(pastDate.getHours() - 1);

  const updated = await prisma.rewindLetter.updateMany({
    where: { status: 'SEALED' },
    data: { deliverAfter: pastDate }
  });

  console.log(`Updated ${updated.count} sealed letter(s) to be eligible for immediate delivery.`);

  // Find all time-ready letters
  const readyLetters = await prisma.rewindLetter.findMany({
    where: {
      status: 'SEALED',
      deliverAfter: { lte: new Date() }
    },
    include: { match: true }
  });

  console.log(`Found ${readyLetters.length} letter(s) ready to deliver now.`);

  for (const letter of readyLetters) {
    const now = new Date();
    await prisma.rewindLetter.update({
      where: { id: letter.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: now
      }
    });

    const recipientId = letter.match.user1Id === letter.authorId
      ? letter.match.user2Id
      : letter.match.user1Id;

    const authorProfile = await prisma.profile.findUnique({
      where: { userId: letter.authorId },
      select: { name: true }
    });

    const recipientProfile = await prisma.profile.findUnique({
      where: { userId: recipientId },
      select: { name: true }
    });

    // Recipient notification
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'REWIND_LETTER',
        title: 'A letter arrives ✉️',
        content: `${authorProfile?.name || 'Your match'} wrote you a Rewind Letter when you first connected.`,
        relatedId: letter.matchId
      }
    });

    // Author notification
    await prisma.notification.create({
      data: {
        userId: letter.authorId,
        type: 'REWIND_LETTER',
        title: 'Letter Delivered ✉️',
        content: `Your Rewind Letter has been delivered to ${recipientProfile?.name || 'your match'}.`,
        relatedId: letter.matchId
      }
    });

    console.log(`✅ Delivered letter ${letter.id} to recipient ${recipientId} (${authorProfile?.name || 'Match'}) & notified author ${letter.authorId}`);
  }

  console.log('--- Done! Both users now have in-app notifications and updated letter cards. ---');
}

triggerDelivery()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
