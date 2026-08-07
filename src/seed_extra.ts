import { PrismaClient, UserStatus, ApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

const demoUsers = [
  {
    phoneNumber: '+919876543210',
    email: 'ananya.s@example.com',
    name: 'Ananya Sharma',
    age: 24,
    dob: new Date('2001-05-14'),
    gender: 'Woman',
    orientation: 'Straight',
    city: 'Mumbai',
    intent: 'Long-term Relationship',
    story: 'Architect by day, vinyl collector by night. Looking for someone who enjoys rooftop coffee and indie art exhibits.',
    interests: ['Architecture', 'Vinyl Records', 'Coffee', 'Art Exhibits'],
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'
  },
  {
    phoneNumber: '+919876543211',
    email: 'kavya.n@example.com',
    name: 'Kavya Nair',
    age: 23,
    dob: new Date('2002-09-20'),
    gender: 'Woman',
    orientation: 'Straight',
    city: 'Bangalore',
    intent: 'Getting to Know People',
    story: 'Product designer passionate about typography, specialty tea, and weekend hikes in Nandi Hills.',
    interests: ['Design', 'Specialty Tea', 'Hiking', 'Typography'],
    photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80'
  },
  {
    phoneNumber: '+919876543212',
    email: 'ria.mehta@example.com',
    name: 'Ria Mehta',
    age: 26,
    dob: new Date('1999-11-03'),
    gender: 'Woman',
    orientation: 'Straight',
    city: 'Mumbai',
    intent: 'Companionship',
    story: 'Culinary enthusiast exploring hidden street food gems. Let us cook pasta together and argue about film plots.',
    interests: ['Cooking', 'Cinema', 'Travel', 'Foodie'],
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80'
  },
  {
    phoneNumber: '+919876543213',
    email: 'tanya.kapoor@example.com',
    name: 'Tanya Kapoor',
    age: 25,
    dob: new Date('2000-02-28'),
    gender: 'Woman',
    orientation: 'Straight',
    city: 'Delhi',
    intent: 'Open to Anything Meaningful',
    story: 'Classical dancer & literature nerd. Always down for late-night jazz sessions and deep conversations.',
    interests: ['Dance', 'Literature', 'Jazz', 'Photography'],
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80'
  },
  {
    phoneNumber: '+919876543214',
    email: 'samyukta.r@example.com',
    name: 'Samyukta Rao',
    age: 27,
    dob: new Date('1998-07-12'),
    gender: 'Woman',
    orientation: 'Straight',
    city: 'Bangalore',
    intent: 'Long-term Relationship',
    story: 'Biotech researcher with a soft spot for acoustic cover songs and pottery workshops on Sundays.',
    interests: ['Biotech', 'Pottery', 'Acoustic Music', 'Scuba Diving'],
    photo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=800&q=80'
  },
  {
    phoneNumber: '+919876543215',
    email: 'aarav.v@example.com',
    name: 'Aarav Verma',
    age: 26,
    dob: new Date('1999-04-18'),
    gender: 'Man',
    orientation: 'Straight',
    city: 'Mumbai',
    intent: 'Long-term Relationship',
    story: 'Software engineer building sustainable tech. Big fan of bouldering, board games, and pour-over coffee.',
    interests: ['Bouldering', 'Tech', 'Board Games', 'Coffee'],
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80'
  },
  {
    phoneNumber: '+919876543216',
    email: 'sid.deshmukh@example.com',
    name: 'Siddharth Deshmukh',
    age: 28,
    dob: new Date('1997-08-05'),
    gender: 'Man',
    orientation: 'Straight',
    city: 'Bangalore',
    intent: 'Getting to Know People',
    story: 'Sound designer & synth collector. Seeking someone to co-create playlists and explore indie cafes.',
    interests: ['Music Production', 'Indie Rock', 'Coffee', 'Design'],
    photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80'
  }
];

async function main() {
  console.log('Seeding extra demo profiles into database...');
  for (const userDef of demoUsers) {
    const existing = await prisma.user.findFirst({
      where: { phoneNumber: userDef.phoneNumber }
    });

    if (!existing) {
      const user = await prisma.user.create({
        data: {
          phoneNumber: userDef.phoneNumber,
          email: userDef.email,
          role: 'USER',
          status: UserStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
          profile: {
            create: {
              name: userDef.name,
              gender: userDef.gender,
              showGender: true,
              orientation: userDef.orientation,
              showOrientation: true,
              city: userDef.city,
              relationshipIntent: userDef.intent,
              relationshipStatus: 'Single',
              interests: userDef.interests,
              languages: ['English', 'Hindi'],
              education: 'Bachelor Degree',
              occupation: 'Professional',
              story: userDef.story,
              dob: userDef.dob,
              photos: {
                create: [
                  {
                    cloudinaryPublicId: `demo_${userDef.name.toLowerCase().replace(/\s+/g, '_')}`,
                    secureUrl: userDef.photo,
                    isPrimary: true,
                    photoOrder: 0
                  }
                ]
              }
            }
          }
        }
      });
      console.log(`Created user: ${user.id} (${userDef.name})`);
    }
  }
  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
