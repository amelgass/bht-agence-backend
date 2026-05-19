require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: '✅ Serveur Agence de Voyage opérationnel !' })
})

app.use('/api/clients', require('./routes/clients.routes'))
app.use('/api/auth', require('./routes/auth.routes'))
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`)
})
