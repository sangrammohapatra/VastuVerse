const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const c = require('../controllers/municipalController');

const router = express.Router();

router.use(authenticateToken);
router.get('/rules', c.getRules);

module.exports = router;
