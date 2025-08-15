const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// Import database connection

const connection = mysql.createConnection({
    host: 'c237-boss.mysql.database.azure.com',
    user: 'c237boss',
    password: 'c237boss!',
    database: 'c237_005_teamfive'
});

// GET /promote - Show promoted parts based on DB flag (e.g., is_promoted)
router.get('/', (req, res) => {
    // Only show products marked as promoted in the DB
    const sql = 'SELECT * FROM products WHERE is_promoted = 1';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching promoted products:', err);
            return res.status(500).send('Error fetching promoted products');
        }
        res.render('promote', {
            user: req.session.user,
            promotedProducts: results
        });
    });
});

module.exports = router;
