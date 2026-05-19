const express  = require('express')
const router   = express.Router()
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma   = new PrismaClient()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' })

    const user = await prisma.users.findUnique({ where: { email } })
    if (!user)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })

    if (!user.is_active)
      return res.status(401).json({ error: 'Compte désactivé' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/register (créer un employé — admin seulement)
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body
    if (!full_name || !email || !password)
      return res.status(400).json({ error: 'Tous les champs sont requis' })

    const existing = await prisma.users.findUnique({ where: { email } })
    if (existing)
      return res.status(400).json({ error: 'Cet email existe déjà' })

    const password_hash = await bcrypt.hash(password, 10)
    const user = await prisma.users.create({
      data: { full_name, email, password_hash, role: role || 'agent' }
    })

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router