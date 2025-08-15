const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// Direct DB connection 
const connection = mysql.createConnection({
    host: 'c237-boss.mysql.database.azure.com',
    user: 'c237boss',
    password: 'c237boss!',
    database: 'c237_005_teamfive'
});
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database (recommend.js)');
});

// Middleware: checkAuth 
const checkAuth = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('Error', 'You need to log in first.');
        return res.redirect('/login');
    }
};

// GET /recommend - Recommend a build based on budget 
router.get('/', checkAuth, (req, res) => {
    // Get budget from user profile or fallback to a value from the database (settings table)
    const userBudget = req.session.user.budget;
    if (userBudget) {
        getRecommendations(userBudget);
    } else {
        // Try to get default budget from a settings table
        connection.query("SELECT value FROM settings WHERE name = 'default_budget' LIMIT 1", (err, rows) => {
            let budget = 1500; // fallback
            if (!err && rows.length > 0) {
                budget = parseFloat(rows[0].value) || 1500;
            }
            getRecommendations(budget);
        });
    }

    function getRecommendations(budget) {
        // Try to get allocation from settings table
        connection.query("SELECT name, value FROM settings WHERE name IN ('cpu_allocation','gpu_allocation','ram_allocation')", (err, rows) => {
            let cpuAlloc = 0.5, gpuAlloc = 0.5, ramAlloc = 0.25; // fallback
            if (!err && rows.length > 0) {
                rows.forEach(row => {
                    if (row.name === 'cpu_allocation') cpuAlloc = parseFloat(row.value) || cpuAlloc;
                    if (row.name === 'gpu_allocation') gpuAlloc = parseFloat(row.value) || gpuAlloc;
                    if (row.name === 'ram_allocation') ramAlloc = parseFloat(row.value) || ramAlloc;
                });
            }
            // Normalize if sum > 1
            const totalAlloc = cpuAlloc + gpuAlloc + ramAlloc;
            if (totalAlloc > 1) {
                cpuAlloc /= totalAlloc;
                gpuAlloc /= totalAlloc;
                ramAlloc /= totalAlloc;
            }
            const sql = `
                SELECT * FROM components WHERE type = 'CPU' AND price <= ? ORDER BY price DESC LIMIT 1;
                SELECT * FROM components WHERE type = 'GPU' AND price <= ? ORDER BY price DESC LIMIT 1;
                SELECT * FROM components WHERE type = 'RAM' AND price <= ? ORDER BY price DESC LIMIT 1;
            `;
            connection.query(sql, [budget * cpuAlloc, budget * gpuAlloc, budget * ramAlloc], (err, results) => {
                if (err) {
                    req.flash('error', 'Database error loading recommendations.');
                    return res.redirect('/dashboard');
                }
                const cpu = results[0][0] || null;
                const gpu = results[1][0] || null;
                const ram = results[2][0] || null;
                res.render('recommend', {
                    user: req.session.user,
                    budget,
                    cpu,
                    gpu,
                    ram,
                    messages: req.flash('success'),
                    error: req.flash('error')
                });
            });
        });
    }
});

module.exports = router;
