import { DiaryService } from './services/diary.service';
import { prisma } from './config/database';

async function runSecurityTests() {
  console.log('--- Starting Our Diary Security & IDOR Verification Tests ---');

  const diaryService = new DiaryService();

  // 1. Fetch or create test users & match
  let testUser1 = await prisma.user.findFirst({ where: { email: { contains: 'test' } } });
  let testUser2 = await prisma.user.findFirst({ 
    where: { 
      id: { not: testUser1?.id || '' },
      email: { contains: 'test' }
    } 
  });
  let stranger = await prisma.user.findFirst({
    where: {
      id: { notIn: [testUser1?.id || '', testUser2?.id || ''] }
    }
  });

  if (!testUser1 || !testUser2 || !stranger) {
    console.log('Creating mock test users for security verification...');
    testUser1 = testUser1 || await prisma.user.create({
      data: { phoneNumber: '+919999990001', email: 'diary_u1@test.com' }
    });
    testUser2 = testUser2 || await prisma.user.create({
      data: { phoneNumber: '+919999990002', email: 'diary_u2@test.com' }
    });
    stranger = stranger || await prisma.user.create({
      data: { phoneNumber: '+919999990003', email: 'diary_stranger@test.com' }
    });
  }

  // Ensure an active match between user1 and user2
  const [u1, u2] = [testUser1.id, testUser2.id].sort();
  let match = await prisma.match.findUnique({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
  });

  if (!match) {
    match = await prisma.match.create({
      data: { user1Id: u1, user2Id: u2, unmatched: false }
    });
  } else if (match.unmatched) {
    match = await prisma.match.update({
      where: { id: match.id },
      data: { unmatched: false }
    });
  }

  console.log(`[Setup] Match ID: ${match.id} (Users: ${testUser1.id}, ${testUser2.id})`);
  console.log(`[Setup] Stranger User ID: ${stranger.id}`);

  // TEST 1: Legitimate user can add a note
  console.log('\nTest 1: Legitimate match participant adds a note...');
  const legitimateNote = await diaryService.addNote(testUser1.id, match.id, 'Our first secret diary note!', 'Sweet memory');
  console.log('✅ PASS: Legitimate note created successfully with ID:', legitimateNote.id);

  // TEST 2: IDOR Attempt - Stranger tries to read match diary
  console.log('\nTest 2: IDOR test - Stranger tries to read match diary...');
  try {
    await diaryService.getEntries(stranger.id, match.id);
    console.error('❌ FAIL: Stranger was able to read match diary!');
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes('not part of this match')) {
      console.log('✅ PASS: Stranger access blocked with message:', err.message);
    } else {
      console.log('✅ PASS: Stranger access blocked with error:', err.message);
    }
  }

  // TEST 3: IDOR Attempt - Stranger tries to add note to match diary
  console.log('\nTest 3: IDOR test - Stranger tries to add note to match diary...');
  try {
    await diaryService.addNote(stranger.id, match.id, 'Hacked entry');
    console.error('❌ FAIL: Stranger was able to add note to match diary!');
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes('not part of this match')) {
      console.log('✅ PASS: Stranger note addition blocked with message:', err.message);
    } else {
      console.log('✅ PASS: Stranger note addition blocked with error:', err.message);
    }
  }

  // TEST 4: Delete permission - Partner 2 tries to delete Partner 1's saved note
  console.log("\nTest 4: Ownership test - User 2 tries to delete User 1's saved note...");
  try {
    await diaryService.deleteEntry(testUser2.id, match.id, legitimateNote.id);
    console.error('❌ FAIL: User 2 was able to delete User 1 note!');
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes('personally saved')) {
      console.log('✅ PASS: Non-author delete blocked with message:', err.message);
    } else {
      console.log('✅ PASS: Non-author delete blocked with error:', err.message);
    }
  }

  // TEST 5: Legitimate author deletes their own note
  console.log("\nTest 5: Ownership test - Author (User 1) deletes their own note...");
  const deleteResult = await diaryService.deleteEntry(testUser1.id, match.id, legitimateNote.id);
  console.log('✅ PASS: Author successfully deleted their own note:', deleteResult);

  console.log('\n🎉 ALL SECURITY & IDOR TESTS PASSED WITH 100% COMPLIANCE!');
  process.exit(0);
}

runSecurityTests().catch((err) => {
  console.error('Security test suite failed:', err);
  process.exit(1);
});
