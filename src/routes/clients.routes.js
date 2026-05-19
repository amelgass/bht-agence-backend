const express = require('express')
const router  = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma  = new PrismaClient()

// GET /api/clients — Liste tous les clients (avec recherche et filtre)
router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { phone:     { contains: search, mode: 'insensitive' } },
      ]
    }

    const [clients, total] = await Promise.all([
      prisma.clients.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: { appointments: { orderBy: { appointment_date: 'asc' }, take: 1 } }
      }),
      prisma.clients.count({ where })
    ])

    res.json({ clients, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/clients/:id — Détail d'un client
router.get('/:id', async (req, res) => {
  try {
    const client = await prisma.clients.findUnique({
      where: { id: req.params.id },
      include: { appointments: { orderBy: { appointment_date: 'desc' } } }
    })
    if (!client) return res.status(404).json({ error: 'Client introuvable' })
    res.json(client)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/clients — Créer un nouveau client
router.post('/', async (req, res) => {
  try {
    const {
      full_name, phone, email, passport_number,
      passport_expiry, destination, visa_type, status, notes
    } = req.body

    if (!full_name) return res.status(400).json({ error: 'Le nom complet est obligatoire' })

    const client = await prisma.clients.create({
      data: {
        full_name,
        phone:           phone || null,
        email:           email || null,
        passport_number: passport_number || null,
        passport_expiry: passport_expiry ? new Date(passport_expiry) : null,
        destination:     destination || null,
        visa_type:       visa_type || null,
        status:          status || 'en_attente',
        notes:           notes || null,
      }
    })
    res.status(201).json(client)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/clients/:id — Modifier un client
router.put('/:id', async (req, res) => {
  try {
    const {
      full_name, phone, email, passport_number,
      passport_expiry, destination, visa_type, status, notes
    } = req.body

    const client = await prisma.clients.update({
      where: { id: req.params.id },
      data: {
        full_name,
        phone,
        email,
        passport_number,
        passport_expiry: passport_expiry ? new Date(passport_expiry) : null,
        destination,
        visa_type,
        status,
        notes,
      }
    })
    res.json(client)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Client introuvable' })
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/clients/:id — Supprimer un client
router.delete('/:id', async (req, res) => {
  try {
    await prisma.clients.delete({ where: { id: req.params.id } })
    res.json({ message: 'Client supprimé avec succès' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Client introuvable' })
    res.status(500).json({ error: err.message })
  }
})

module.exports = router