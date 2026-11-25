const admin = require('firebase-admin');

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/set-admin-claim.js <admin-email>');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });

const grantAdminClaim = async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, {
      ...user.customClaims,
      admin: true
    });
    console.log(`Admin claim granted to ${email}. Ask the user to sign out and sign in again.`);
  } catch (error) {
    console.error('Could not grant admin claim:', error);
    process.exitCode = 1;
  } finally {
    await admin.app().delete();
  }
};

grantAdminClaim();
