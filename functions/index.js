/**
 * GLP — Firebase Cloud Functions
 *
 * Deploy:  firebase deploy --only functions
 * Secrets: firebase functions:config:set gmail.user="..." gmail.password="..."
 *          (then access via functions.config().gmail.user)
 *
 * For Gen 2 secrets use: firebase functions:secrets:set GMAIL_USER
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Return current time in a given IANA timezone as HH:MM */
function localTimeInTZ(timezone) {
  try {
    return new Date().toLocaleTimeString('it-IT', {
      timeZone: timezone,
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return new Date().toLocaleTimeString('it-IT', {
      timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
}

/** Current date string YYYY-MM-DD in the given timezone */
function localDateInTZ(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).formatToParts(new Date());
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/** Parse today's dailyLog for a user and count done/total habits */
function countHabitsForDate(userData, dateStr) {
  const log = userData.dailyLogs?.[dateStr] || {};
  const done = Array.isArray(log) ? log.length : (log.habits || []).length;
  const active = (userData.habits || []).filter(h =>
    !h.archivedAt && h.type !== 'goal' &&
    (h.type === 'single' ? h.targetDate === dateStr : true)
  ).length;
  return { done, total: active, pending: Math.max(0, active - done) };
}

/** Send FCM notification to all tokens of a user */
async function sendFcmToUser(userId, notification, data = {}) {
  const tokensSnap = await db.collection('users').doc(userId).collection('fcmTokens').get();
  const sends = [];
  tokensSnap.forEach(doc => {
    const { token } = doc.data();
    if (!token) return;
    sends.push(
      admin.messaging().send({
        token,
        notification,
        webpush: {
          notification: {
            icon: 'https://flaviocrisci.github.io/GLP-App-Claude/icons/icon-192x192.png',
            badge: 'https://flaviocrisci.github.io/GLP-App-Claude/icons/icon-72x72.png',
            requireInteraction: false,
          },
          fcmOptions: { link: 'https://flaviocrisci.github.io/GLP-App-Claude/' },
        },
        data,
      }).catch(err => {
        // Remove stale tokens
        if (err.code === 'messaging/registration-token-not-registered') {
          doc.ref.delete();
        }
      })
    );
  });
  await Promise.all(sends);
}

// ─── 1. Daily Reminders ───────────────────────────────────────────────────────

exports.sendDailyReminders = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Europe/Rome')
  .onRun(async () => {
    const usersSnap = await db.collection('users').get();
    const promises = [];

    usersSnap.forEach(userDoc => {
      promises.push((async () => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userName = userId === 'flavio' ? 'Flavio' : 'Simona';

        // Read notification settings (subcollection document)
        const settingsDoc = await db
          .collection('users').doc(userId)
          .collection('settings').doc('notifications')
          .get();

        if (!settingsDoc.exists) return;
        const settings = settingsDoc.data();
        if (!settings.enabled) return;

        const tz = settings.timezone || 'Europe/Rome';
        const localTime = localTimeInTZ(tz);   // HH:MM
        const localDate = localDateInTZ(tz);    // YYYY-MM-DD

        for (const reminder of (settings.reminders || [])) {
          // Match hour (ignore minutes for simplicity — scheduled every hour on the hour)
          if (!reminder.time) continue;
          const [rH] = reminder.time.split(':');
          const [lH] = localTime.split(':');
          if (rH !== lH) continue;

          // Compose notification body
          const { done, total, pending } = countHabitsForDate(userData, localDate);
          let body;
          const isEvening = parseInt(rH) >= 18;

          if (pending === 0) {
            body = `Perfetto ${userName}! Hai completato tutte le abitudini oggi 🎉`;
          } else if (isEvening) {
            body = `È ora della revisione serale! Hai completato ${done}/${total} abitudini oggi`;
          } else {
            body = `Buongiorno ${userName}! Hai ${pending} abitudine${pending > 1 ? 'i' : ''} da completare oggi 💪`;
          }

          await sendFcmToUser(userId, {
            title: reminder.label || 'GLP Reminder',
            body,
          }, {
            type: 'reminder',
            date: localDate,
            net: String(userData.score || 0),
            pending: String(pending),
          });
        }
      })());
    });

    await Promise.all(promises);
    functions.logger.info('Daily reminders sent');
    return null;
  });

// ─── 2. Persistent Notification Refresh (each hour) ─────────────────────────

exports.refreshPersistentNotifications = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Europe/Rome')
  .onRun(async () => {
    const usersSnap = await db.collection('users').get();
    const promises = [];

    usersSnap.forEach(userDoc => {
      promises.push((async () => {
        const userId = userDoc.id;
        const userData = userDoc.data();

        const settingsDoc = await db
          .collection('users').doc(userId)
          .collection('settings').doc('notifications')
          .get();

        if (!settingsDoc.exists) return;
        const settings = settingsDoc.data();
        if (!settings.persistentEnabled) return;

        const tz = settings.timezone || 'Europe/Rome';
        const localDate = localDateInTZ(tz);
        const { done, total, pending } = countHabitsForDate(userData, localDate);

        // Streak calc (simple)
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const ds = d.toISOString().split('T')[0];
          const log = userData.dailyLogs?.[ds];
          const earned = Array.isArray(log) ? log.length : (log?.habits?.length || 0);
          if (earned > 0) streak++;
          else break;
        }

        const net = userData.score || 0;
        await sendFcmToUser(userId, {
          title: `GLP — Oggi: ${net >= 0 ? '+' : ''}${net}pt`,
          body: `${pending} abitudini mancanti · Streak: ${streak}🔥`,
        }, {
          type: 'persistent',
          tag: 'glp-persistent',
        });
      })());
    });

    await Promise.all(promises);
    return null;
  });

// ─── 3. Weekly Backup Email ───────────────────────────────────────────────────

exports.sendWeeklyBackup = functions.pubsub
  .schedule('0 20 * * 0')   // Every Sunday at 20:00
  .timeZone('Europe/Rome')
  .onRun(async () => {
    const gmailUser = functions.config().gmail?.user;
    const gmailPass = functions.config().gmail?.password;

    if (!gmailUser || !gmailPass) {
      functions.logger.warn('Gmail credentials not set. Run: firebase functions:config:set gmail.user="..." gmail.password="..."');
      return null;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    const usersSnap = await db.collection('users').get();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const promises = [];
    usersSnap.forEach(userDoc => {
      promises.push((async () => {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Read email settings
        const emailDoc = await db
          .collection('users').doc(userId)
          .collection('settings').doc('email')
          .get();

        if (!emailDoc.exists) return;
        const emailSettings = emailDoc.data();
        if (!emailSettings.enabled || !emailSettings.address) return;

        const userName = userId === 'flavio' ? 'Flavio' : 'Simona';

        // Weekly stats (last 7 days)
        let weekNet = 0, weekDone = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const ds = d.toISOString().split('T')[0];
          const log = userData.dailyLogs?.[ds];
          const entry = Array.isArray(log) ? { habits: log, purchases: [] } : (log || { habits: [], purchases: [] });
          weekDone += (entry.habits || []).length;
        }

        // Backup JSON
        const backupData = JSON.stringify({ [userId]: userData }, null, 2);
        const backupFileName = `GLP_Backup_${dateStr}.json`;

        await transporter.sendMail({
          from: `GLP App <${gmailUser}>`,
          to: emailSettings.address,
          subject: `GLP Backup settimanale — ${dateStr}`,
          html: `
            <h2>🔥 GLP — Riepilogo Settimana</h2>
            <p>Ciao ${userName}!</p>
            <ul>
              <li><strong>Punteggio totale:</strong> ${userData.score || 0} pt</li>
              <li><strong>Abitudini completate questa settimana:</strong> ${weekDone}</li>
            </ul>
            <p>In allegato trovi il backup completo dei tuoi dati.</p>
            <p><small>GLP — Gamification Life Project</small></p>
          `,
          attachments: [{
            filename: backupFileName,
            content: backupData,
            contentType: 'application/json',
          }],
        });

        // Update lastBackupSent
        await db.collection('users').doc(userId)
          .collection('settings').doc('email')
          .update({ lastBackupSent: new Date().toISOString() });

        functions.logger.info(`Backup sent to ${emailSettings.address} for ${userId}`);
      })());
    });

    await Promise.all(promises);
    return null;
  });

// ─── 4. Send Backup Now (Callable) ───────────────────────────────────────────

exports.sendBackupNow = functions.https.onCall(async (data, context) => {
  const { userId, email } = data;
  if (!userId || !email) throw new functions.https.HttpsError('invalid-argument', 'userId and email required');

  const gmailUser = functions.config().gmail?.user;
  const gmailPass = functions.config().gmail?.password;
  if (!gmailUser || !gmailPass) {
    throw new functions.https.HttpsError('failed-precondition', 'Gmail credentials not configured');
  }

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

  const userData = userDoc.data();
  const dateStr = new Date().toISOString().split('T')[0];
  const userName = userId === 'flavio' ? 'Flavio' : 'Simona';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const backupData = JSON.stringify({ [userId]: userData }, null, 2);

  await transporter.sendMail({
    from: `GLP App <${gmailUser}>`,
    to: email,
    subject: `GLP Backup manuale — ${dateStr}`,
    html: `<h2>🔥 GLP Backup Manuale</h2><p>Ciao ${userName}! Backup richiesto il ${dateStr}.</p>`,
    attachments: [{ filename: `GLP_Backup_${dateStr}.json`, content: backupData, contentType: 'application/json' }],
  });

  // Update lastBackupSent
  await db.collection('users').doc(userId)
    .collection('settings').doc('email')
    .set({ lastBackupSent: new Date().toISOString() }, { merge: true });

  return { success: true };
});

// ─── 5. Check Goal Deadlines ──────────────────────────────────────────────────

exports.checkGoalDeadlines = functions.pubsub
  .schedule('0 0 * * *')   // Every day at midnight
  .timeZone('Europe/Rome')
  .onRun(async () => {
    const today = new Date().toISOString().split('T')[0];
    const usersSnap = await db.collection('users').get();
    const promises = [];

    usersSnap.forEach(userDoc => {
      promises.push((async () => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const habits = userData.habits || [];
        let changed = false;
        let score = userData.score || 0;

        const updatedHabits = habits.map(h => {
          if (h.type !== 'goal' || !h.goalConfig) return h;
          const gc = h.goalConfig;
          if (gc.expiredAt || gc.completedAt) return h;
          if (gc.deadline && gc.deadline < today && (gc.currentValue || 0) < gc.targetValue) {
            // Expired
            changed = true;
            score -= (gc.penaltyOnFail || 0);
            sendFcmToUser(userId, {
              title: `Obiettivo scaduto: ${h.name}`,
              body: `L'obiettivo è scaduto — -${gc.penaltyOnFail || 0}pt`,
            }, { type: 'goal_expired' });
            return { ...h, goalConfig: { ...gc, expiredAt: today } };
          }
          return h;
        });

        if (changed) {
          await db.collection('users').doc(userId).update({ habits: updatedHabits, score });
        }
      })());
    });

    await Promise.all(promises);
    return null;
  });
