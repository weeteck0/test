const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
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
    console.log('Connected to MySQL database (builds.js)');
});

// Middleware: checkAuth and checkAdmin (copied from app.js for self-containment)
const checkAuth = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('Error', 'You need to log in first.');
        return res.redirect('/login');
    }
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('Error', 'Access Denied');
        return res.redirect('/index');
    }
};

// GET: Edit Build Page
router.get('/:id/edit', checkAuth, (req, res) => {
    const buildId = req.params.id;
    const userId = req.session.user.id;

    connection.query('SELECT * FROM builds WHERE id = ? AND user_id = ?', [buildId, userId], (err, result) => {
        if (err) throw err;
        if (result.length === 0) return res.redirect('/dashboard');

        const build = result[0];

        connection.query('SELECT * FROM components WHERE type = "CPU"', (err, cpus) => {
            if (err) throw err;
            connection.query('SELECT * FROM components WHERE type = "GPU"', (err, gpus) => {
                if (err) throw err;
                connection.query('SELECT * FROM components WHERE type = "RAM"', (err, rams) => {
                    if (err) throw err;

                    res.render('editBuild', {
                        build,
                        cpus,
                        gpus,
                        rams,
                        budget: req.session.user.budget || 2000,
                        messages: req.flash('success'),
                        user: req.session.user
                    });
                });
            });
        });
    });
});

// POST: Update Build
router.post('/:id/edit', checkAuth, (req, res) => {
    const buildId = req.params.id;
    const userId = req.session.user.id;
    const { cpu_id, gpu_id, ram_id } = req.body;

    // Validate required fields
    if (!cpu_id || !gpu_id || !ram_id) {
        req.flash('error', 'All components (CPU, GPU, RAM) are required.');
        return res.redirect(`/builds/${buildId}/edit`);
    }

    const getPrice = (id, callback) => {
        if (!id) {
            return callback(null, new Error('Component ID is required'));
        }
        
        connection.query('SELECT price FROM components WHERE id = ?', [id], (err, results) => {
            if (err) return callback(null, err);
            if (results.length === 0) return callback(null, new Error('Component not found'));
            callback(results[0].price, null);
        });
    };

    getPrice(cpu_id, (cpuPrice, cpuErr) => {
        if (cpuErr) {
            req.flash('error', 'Error fetching CPU price: ' + cpuErr.message);
            return res.redirect(`/builds/${buildId}/edit`);
        }
        
        getPrice(gpu_id, (gpuPrice, gpuErr) => {
            if (gpuErr) {
                req.flash('error', 'Error fetching GPU price: ' + gpuErr.message);
                return res.redirect(`/builds/${buildId}/edit`);
            }
            
            getPrice(ram_id, (ramPrice, ramErr) => {
                if (ramErr) {
                    req.flash('error', 'Error fetching RAM price: ' + ramErr.message);
                    return res.redirect(`/builds/${buildId}/edit`);
                }
                
                const total = cpuPrice + gpuPrice + ramPrice;

                connection.query(
                    'UPDATE builds SET cpu_id = ?, gpu_id = ?, ram_id = ?, total_price = ?, last_updated = NOW() WHERE id = ? AND user_id = ?',
                    [cpu_id, gpu_id, ram_id, total, buildId, userId],
                    (err, result) => {
                        if (err) {
                            req.flash('error', 'Database error: ' + err.message);
                            return res.redirect(`/builds/${buildId}/edit`);
                        }
                        
                        if (result.affectedRows === 0) {
                            req.flash('error', 'Build not found or access denied.');
                            return res.redirect('/dashboard');
                        }
                        
                        req.flash('success','Build updated successfully!');
                        res.redirect('/dashboard');
                    }
                );
            });
        });
    });
});

module.exports = router;
