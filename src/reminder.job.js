require('dotenv').config()
const cron   = require('node-cron')
const twilio = require('twilio')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

async function sendReminders() {
  console.log(`[${new Date().toISOString()}] Vérification des rendez-vous...`)

  const now      = new Date()
  const in10days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)

  const dateStart = new Date(in10days)
  dateStart.setHours(0, 0, 0, 0)
  const dateEnd = new Date(in10days)
  dateEnd.setHours(23, 59, 59, 999)

  const appointments = await prisma.appointments.findMany({
    where: {
      appointment_date: { gte: dateStart, lte: dateEnd },
      status: { in: ['planifie', 'confirme'] },
    },
    include: { clients: true },
  })

  console.log(`  → ${appointments.length} rendez-vous trouvé(s)`)

  for (const appt of appointments) {
    const c = appt.clients
    if (!c.phone) continue

    const existing = await prisma.reminders.findFirst({
      where: { appointment_id: appt.id, status: 'sent' },
    })
    if (existing) continue

    const dateFormatted = new Date(appt.appointment_date).toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const messageBody =
      `Bonjour ${c.full_name}, votre rendez-vous approche. ` +
      `Merci de vous présenter à l'agence le ${dateFormatted}. — BHT Travel Immo`

    const reminder = await prisma.reminders.create({
      data: {
        appointment_id: appt.id,
        scheduled_at:   new Date(),
        channel:        'sms',
        status:         'pending',
        message_body:   messageBody,
      },
    })

    try {
      await client.messages.create({
        body: messageBody,
        from: process.env.TWILIO_FROM_NUMBER,
        to:   c.phone,
      })

      await prisma.reminders.update({
        where: { id: reminder.id },
        data: { status: 'sent', sent_at: new Date() },
      })

      console.log(`  ✓ SMS envoyé à ${c.full_name} (${c.phone})`)

    } catch (err) {
      await prisma.reminders.update({
        where: { id: reminder.id },
        data: { status: 'failed', error_message: err.message },
      })
      console.error(`  ✗ Erreur pour ${c.full_name}: ${err.message}`)
    }
  }

  console.log(`Terminé.\n`)
}

// Exécution chaque jour à 8h00
cron.schedule('0 8 * * *', sendReminders, {
  timezone: 'Africa/Dakar'
})

console.log('⏰ Scheduler démarré — rappels envoyés chaque jour à 08:00')

// Décommenter pour tester immédiatement :
// sendReminders()