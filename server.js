const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const multer = require('multer');
const { storage } = require('./utils/cloudinary');
const upload = multer({ storage });
const User = require('./models/User');
// Load environment variables
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Session Store in MongoDB
const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: 'sessions'
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: store
}));

const sendResetEmail = async (to, resetLink) => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: true, // true if using port 465
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"TrendTracker" <${process.env.MAIL_USER}>`,
    to,
    subject: '🔐 Password Reset Link - TrendTracker',
    html: `
      <p>Hello,</p>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetLink}" target="_blank"
   style="color: #00ffc3; font-weight: bold; text-decoration: none;
          text-shadow: 0 0 5px #00ffc3, 0 0 10px #00ffc3;
          font-family: 'Poppins', sans-serif;">
   Reset Password
</a>
      <p><b>This link will expire in 15 minutes.</b></p>
    `
  });
};

function generateUserId() {
  return 'TTUSR' + Math.floor(100000 + Math.random() * 900000);
}

function checkAuth(req, res, next) {
  if (req.session && req.session.user) {
    next(); 
  } else {
    res.redirect('/'); 
  }
}



app.get('/', (req, res) => {
  res.render('index', { error: null,success: null });
});
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('signup', { error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateUserId();

    const newUser = new User({
      userId,
      username,
      email,
      password: hashedPassword,
      
    });

    await newUser.save();

    req.session.user = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      
      userId: newUser.userId
    };
    req.session.successMessage = '🎉 Account created successfully!';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('signup', { error: 'Signup failed. Please try again.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('index', { error: 'Email not registered' ,success: null});
    }

    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('index', { error: 'Invalid password',success: null });
    }

    
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      image: user.image,
      userId: user.userId
    };

    
    req.session.successMessage = 'Login successful';

    
    res.redirect('/dashboard');

  } catch (err) {
    console.error('Login error:', err);
    res.render('index', { error: 'Something went wrong. Try again.',success: null });
  }
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('index', { error: 'Email not registered',success: null });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 15 * 60 * 1000; // 15 mins

    user.resetToken = token;
    user.resetTokenExpiry = expiry;
    await user.save();

    const resetLink = `http://localhost:3001/reset-password/${token}`;
    await sendResetEmail(email, resetLink);

    console.log(`✅ Reset email sent to: ${email}`);
    res.render('index', { success: '📬 Reset link sent! Check your inbox.' ,error:null});

  } catch (err) {
    console.error('❌ Reset link error:', err);
    res.render('index', { error: 'Failed to send reset link. Try again later.',success: null });
  }
});

app.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
 console.log("🔐 Received token from URL:", token);

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      console.log("❌ Token invalid or expired or user not found");
      return res.render('index', { error: '⛔ Reset link is invalid or expired.', success: null });
    }

    res.render('reset-password', { token, error: null });
  } catch (err) {
    console.error('❌ Error loading reset page:', err);
    res.render('index', { error: 'Something went wrong. Please try again.',success: null });
  }
});
app.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.render('index', { error: '⛔ Reset link is invalid or expired.',success: null });
    }

    const hashed = await bcrypt.hash(password, 12);
    user.password = hashed;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log(`✅ Password reset for ${user.email}`);
    res.render('index', { success: '✅ Password reset successful! You can now login.',error: null });

  } catch (err) {
    console.error('❌ Password reset error:', err);
    res.render('reset-password', { token, error: 'Something went wrong. Try again.' });
  }
});


app.get('/dashboard',checkAuth, (req, res) => {
 
  const message = req.session.successMessage || null;
  req.session.successMessage = null; // clear it after use

  res.render('dashboard', { user: req.session.user, message });
});



app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});



app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});


