const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const letters = await prisma.rewindLetter.findMany({
    include: {
      match: {
        include: {
          user1: { include: { profile: true } },
          user2: { include: { profile: true } }
        }
      }
    }
  });

  const profiles = await prisma.profile.findMany({ select: { userId: true, name: true } });

  console.log('PROFILES:', profiles);
  console.log('LETTERS IN DB:', JSON.stringify(letters.map(l => ({
    id: l.id,
    matchId: l.matchId,
    authorId: l.authorId,
    authorName: profiles.find(p => p.userId === l.authorId)?.name,
    status: l.status,
    content: l.content,
    user1: { id: l.match.user1Id, name: l.match.user1?.profile?.name },
    user2: { id: l.match.user2Id, name: l.match.user2?.profile?.name }
  })), null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
