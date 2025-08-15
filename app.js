//////////////////////////////////////////////////
// Initialize modules
//////////////////////////////////////////////////

const express = require('express');
const app = express();
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

// Set up view engine
app.set('view engine', 'ejs');
//  enable flash messages
app.use(flash());
//  enable static files 
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

const validAdminCodes = ['ABCD1234'];

// Import database connection
const connection = require('./db');

//////////////////////////////////////////////////
//  Register LogIn Modules (by Roshuko)
//////////////////////////////////////////////////

app.use(session({
    secret: 'c237team5', // secret key for session, used for signing the session ID cookie
    resave: false,       // don't save session if unmodified
    saveUninitialized: true,   // save uninitialized session
    cookie: {maxAge : 1000 * 60 * 60 * 12} // last number indicate number of hours session will last
}))

const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, authCode } = req.body;

    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Checking if user is logged in
const checkAuth = (req, res, next) => {
    if (req.session.user) {
        return next(); // Proceed to the next whatever if session exists (logged in)
    }
    else {
        req.flash('Error', 'You need to log in first.');
        return res.redirect('/login'); // Redirect to login if session does not exist (not logged in)
    }
};

// Check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next(); // User is admin, let them proceed
    }
    else {
        req.flash('Error', 'Access Denied');
        return res.redirect('/'); // User is not admin, redirect to home
    }
};

//////////////////////////////////////////////////
// Get Routes
//////////////////////////////////////////////////

// Use route modules
app.get('/builds', (req, res) => {
    res.render('builds', { user: req.session.user, messages: req.flash('success') });
});
app.get('/recommend', (req, res) => {
    res.render('recommend', { user: req.session.user, messages: req.flash('success') });
});
app.use('/promote', (req, res) => {
    res.render('promote', { user: req.session.user, messages: req.flash('success') });
});

// Route to Index
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success')});
});

// Route to Register
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
}); 

// Route to Login
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('error') });
});

// Route to Recover
app.get('/recover', (req, res) => {
    res.render('recover', { messages: req.flash('error') });
});

// Route to Dashboard (protected)
app.get('/dashboard', checkAuth, (req, res) => {
    res.render('dashboard', {
        user: req.session.user,
        messages: req.flash('success')
    });
});
////////// addproduct ////////////
app.get('/addProduct', checkAuth, checkAdmin, (req, res) => {
    res.render('addProduct', {user: req.session.user } ); 
});



// ***  VIEW/LIST ***

// Products listing with search and category filter
app.get('/products', checkAuth, (req, res) => {
    const { search, category } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    let params = [];
    
    // Add search functionality 
    if (search) {
        sql += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    
    // Add category filter
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    
    sql += ' ORDER BY name';
    
    connection.query(sql, params, (error, results) => {
        if (error) throw error;
        
        // Get categories for dropdown
        connection.query('SELECT DISTINCT category FROM products', (err, categories) => {
            if (err) throw err;
            
            res.render('products', { 
                user: req.session.user, 
                products: results,
                categories: categories,
                filters: { search, category }
            });
        });
    });
});

// List/View product details
app.get('/product/:id', checkAuth, (req, res) => {
    const productId = req.params.id;

    connection.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            const product = results[0];
            
            // Get related products from same category
            connection.query('SELECT * FROM products WHERE category = ? AND id != ? LIMIT 3', 
                [product.category, productId], (err, relatedProducts) => {
                if (err) throw err;
                
                res.render('product-detail', { 
                    product: product, 
                    relatedProducts: relatedProducts,
                    user: req.session.user  
                });
            });
        } else {
            res.status(404).send('Product not found');
        }
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect('/');
    });
});

// Password reset route
app.get('/passreset', (req, res) => {
    // Check if user has a valid password reset session
    if (!req.session.passwordResetEmail) {
        req.flash('error', 'Invalid access. Please start the password recovery process again.');
        return res.redirect('/recover');
    }
    
    res.render('passreset', { 
        email: req.session.passwordResetEmail,
        messages: req.flash('error'), 
        formData: req.flash('formData')[0] 
    });
}); 
 
app.get('/updateProduct/:id',checkAuth, checkAdmin, (req,res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE id = ?';
    connection.query(sql , [productId], (error, results) => {
        if (error) throw error;
        if (results.length > 0) {
            res.render('updateProduct', { product: results[0] });
        } else {
            res.status(404).send('Product not found');
        }
    });
});

app.get('/admin', checkAuth, checkAdmin, (req, res) => {
    res.render('admin', {
        user: req.session.user
    });
});
// List users
app.get('/admin/users', checkAuth, checkAdmin, (req, res) => {
  connection.query('SELECT id, username, email, role FROM users ORDER BY id', (err, results) => {
    if (err) throw err;
    res.render('userList', {
      user: req.session.user,
      users: results,
      messages: req.flash('success')
    });
  });
});

//Editing user profile
app.get('/editUsers/:id', checkAuth, (req, res) => {
    const userId = req.params.id;

    const sql = 'SELECT * FROM users WHERE id = ?';
    connection.query(sql, [userId], (error, results) => {
        if (error) {
            console.error('Error retrieving user:', error);
            return res.status(500).send('Error retrieving user.');
        }

        if (results.length > 0) {
            res.render('editUsers', {
                user: req.session.user,
                targetUser: results[0],
                messages: req.flash('error')
            });
        } else {
            res.status(404).send('User not found.');
        }
    });
});



//////////////////////////////////////////////////
//  POST Routes
//////////////////////////////////////////////////


// REGISTER POST ROUTE
app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role, authCode } = req.body;

    // Define the registerUser function
    function registerUser() {
        const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
        connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
            if (err) {
                console.error('Error registering user:', err);
                req.flash('error', 'Registration failed. Please try again.');
                return res.redirect('/register');
            }
            console.log(result);
            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    }

    // If role is admin, validate the auth code
    if (role === 'admin') {
        if (!validAdminCodes.includes(authCode)) {
            req.flash('error', 'Invalid admin authorization code.');
            return res.redirect('/register');
        }
        // Proceed to register admin
        registerUser();
    } else {
        registerUser();
    }
});

// LOGIN POST ROUTE
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Database error occurred.');
            return res.redirect('/login');
        }
        
        if (results.length > 0) {
            req.session.user = {
                id: results[0].id,
                username: results[0].username,
                email: results[0].email,
                role: results[0].role
            };
            req.flash('success', 'Welcome back, ' + results[0].username + '!');
            res.redirect('/');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Recover POST ROUTE
app.post('/recover', (req, res) => {
    const { email } = req.body;

    // Check if the email exists in the database
    const sql = 'SELECT * FROM users WHERE email = ?';
    connection.query(sql, [email], (error, results) => {
        if (error) {
            console.error('Error checking email:', error);
            req.flash('error', 'An error occurred. Please try again.');
            return res.redirect('/recover');
        }

        if (results.length > 0) {
            // Email exists, generate and store OTP in session
            const otp = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
            console.log('Generated OTP for recovery:', otp);
            
            // Store OTP and email in session for verification
            req.session.recoveryOTP = otp;
            req.session.recoveryEmail = email;
            
            // redirect to OTP verification page
            res.render('verify-otp', { 
                email: email, 
                messages: req.flash('error')
            });
        } else {
            req.flash('error', 'Email not found.');
            res.redirect('/recover');
        }
    });
});

// Verify OTP POST ROUTE
app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    // Check if session has changed or expired
    if (!req.session.recoveryOTP || !req.session.recoveryEmail) {
        req.flash('error', 'Session expired. Please request a new OTP.');
        return res.redirect('/recover');
    }
    if (req.session.recoveryEmail !== email) {
        req.flash('error', 'Invalid session. Please try again.');
        return res.redirect('/recover');
    }

    // Verify OTP
    // parseInt change the otp string to integer
    if (parseInt(otp) === req.session.recoveryOTP) {
        // OTP is correct, clear OTP from session! but keep email for password reset page reuse
        delete req.session.recoveryOTP;
        // Change name of session variable to passwordResetEmail and store it for session
        req.session.passwordResetEmail = req.session.recoveryEmail;
        // Clear old recovery email from session
        delete req.session.recoveryEmail;
        
        req.flash('success', 'OTP verified successfully! You can now reset your password.');
        res.redirect('/passreset');
    } else {
        req.flash('error', 'Invalid OTP. Please try again.');
        res.render('verify-otp', { 
            email: email, 
            messages: req.flash('error')
        });
    }
});

// Reset password POST ROUTE
app.post('/resetpass', (req, res) => {
    const { email, password } = req.body;

    // Check again if user has same email and password reset session
    if (!req.session.passwordResetEmail) {
        req.flash('error', 'Invalid access. Please start the password recovery process again.');
        return res.redirect('/recover');
    }
    if (req.session.passwordResetEmail !== email) {
        req.flash('error', 'Invalid session. Please try again.');
        return res.redirect('/recover');
    }

    // Update password in database finally
    const sql = 'UPDATE users SET password = SHA1(?) WHERE email = ?';
    connection.query(sql, [password, email], (error, results) => {
        if (error) {
            console.error('Error updating password:', error);
            req.flash('error', 'Failed to reset password. Please try again.');
            return res.redirect('/passreset');
        }

        // Clear password reset session. Important.
        delete req.session.passwordResetEmail;

        console.log('Password reset successful for:', email);
        req.flash('success', 'Password reset successfully! Please log in with your new password.');
        res.redirect('/login');
    });
});


//////////addproduct///////////
app.post('/addProduct', upload.single('image'),  (req, res) => {
    const { name, category, brand, price, stock_quantity, description, compatibility } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename;
    } else {
        image = null;
    }

    const sql = 'INSERT INTO products (name, category, brand, price, stock_quantity, description, compatibility, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql , [name, category, brand, price, stock_quantity, description, compatibility, image], (error, results) => {
        if (error) {
            console.error("Error adding product:", error);
            res.status(500).send('Error adding product');
        } else {
            res.redirect('/products');
        }
    });
});

app.post('/updateProduct/:id', upload.single('image'), (req, res) => {
    const productId = req.params.id;
    const { name, category, brand, price, stock_quantity, description, compatibility, currentImage } = req.body;
    const image = req.file ? req.file.filename : currentImage;

    const sql = 'UPDATE products SET name = ? , category = ?, brand = ?, price = ?, stock_quantity = ?, description = ?, compatibility = ?, image_url = ? WHERE id = ?';
    connection.query(sql, [name, category, brand, price, stock_quantity, description, compatibility, image, productId], (error, results) => {
        if (error) {
            console.error("Error updating product:", error);
            res.status(500).send('Error updating product');
        } else {
            res.redirect('/products');
        }
    });
});
//////////deleteproduct///////////
app.get('/deleteProduct/:id', checkAuth, (req, res) => {
  const productId = req.params.id;
  const sql = 'DELETE FROM products WHERE id = ?';

  connection.query(sql, [productId], (error, results) => {
    if (error) {
      console.error("Error deleting product:", error);
      res.status(500).send('Error deleting product');
    } else {
      req.flash('success', 'Product deleted successfully.');
      res.redirect('/products');
    }
  });
});

app.post('/builds', checkAuth, (req, res) => {
    req.flash('success', 'Build saved successfully!');
    res.redirect('/builds');
});

// Process edit user form
app.post('/admin/editUser/:id', checkAuth, checkAdmin, (req, res) => {
  const userId = req.params.id;
  const { username, email, address, contact } = req.body;

  const sql = 'UPDATE users SET username = ?, email = ?, address = ?, contact = ? WHERE id = ?';
  connection.query(sql, [username, email, address, contact, userId], (err) => {
    if (err) {
      req.flash('error', 'Failed to update user');
      return res.redirect('/admin/editUser/' + userId);
    }
    req.flash('success', 'User updated successfully');
    res.redirect('/admin/users');
  });
});

//////////////////////////////////////////////////
//  Initialize hosting 
//////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
// Listen and print port to console
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
