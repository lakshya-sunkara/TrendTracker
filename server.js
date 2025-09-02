
const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const axios = require('axios');
 // put in .env

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
const API_KEY = process.env.YOUTUBE_API_KEY;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
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
  profileImage: user.profileImage,  // ✅ correct
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

async function getRedditAccessToken() {
  const creds = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");

  const res = await axios.post("https://www.reddit.com/api/v1/access_token",
    new URLSearchParams({ grant_type: "client_credentials" }),
    {
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

  return res.data.access_token;
}

async function fetchTopRedditPosts() {
  const token = await getRedditAccessToken();

  const res = await axios.get("https://oauth.reddit.com/r/worldnews/top", {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 5 }
  });

  return res.data.data.children.map(post => ({
    title: post.data.title,
    url: `https://reddit.com${post.data.permalink}`,
    subreddit: post.data.subreddit,
    thumbnail: post.data.thumbnail,
  }));
}
app.get("/dashboard",checkAuth, async (req, res) => {
  const message = req.session.successMessage || null;
  req.session.successMessage = null;
  try {
    
    // Fetch trending YouTube videos
    const ytResponse = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
      params: {
        part: "snippet",
        chart: "mostPopular",
        maxResults: 5,
        regionCode: "IN", // use "IN", "GB", etc. for other countries
        key: API_KEY
      }
    });

    const trendingYouTube = ytResponse.data.items.map(video => ({
      title: video.snippet.title,
      channel: video.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnail: video.snippet.thumbnails.medium.url
    }));

    // Inside your /dashboard route
    
    const trendingReddit = await fetchTopRedditPosts();


    // Render with data
     res.render("dashboard", {
      user: req.session.user,
      trendingYouTube,
      
      trendingReddit,
      
      message
    });

  } catch (error) {
    console.error("YouTube API error:", error.response?.data || error.message);
    res.render("dashboard", {
      user: req.session.user,
      
      trendingYouTube: [],
      trendingReddit: [],
      
      message
    });
  }
});



app.post('/upload-profile', checkAuth, upload.single('profileImage'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const imagePath = req.file.path;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage: imagePath },
      { new: true }
    );

    // Update session
    req.session.user.profileImage = updatedUser.profileImage;


    req.session.successMessage = '📸 Profile photo updated!';
    res.redirect('/dashboard');
  } catch (err) {
    console.error('❌ Upload error:', err);
    req.session.successMessage = '⚠️ Failed to upload image.';
    res.redirect('/dashboard');
  }
});



// Search Keyword page
app.get("/search",checkAuth, (req, res) => {
  
  res.render("search", {
    user: req.session.user,
    keyword: null,
    youtubeResults: [],
    redditResults: []
  });
  
});


app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});



// Handle keyword search
app.post("/search", async (req, res) => {
  const { keyword } = req.body;

  try {
    // ✅ Fetch YouTube videos
    const ytResponse = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: keyword,
        maxResults: 10,
        type: "video",
        key: API_KEY
      }
    });

    const youtubeResults = ytResponse.data.items.map(item => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.medium.url
    }));

    // ✅ Fetch Reddit posts (no API key needed for public)
    const redditResponse = await axios.get(`https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&limit=10`);

    const redditResults = redditResponse.data.data.children.map(post => ({
  title: post.data.title,
  subreddit: post.data.subreddit,
  url: `https://reddit.com${post.data.permalink}`,
  thumbnail: post.data.thumbnail
}));


    // Render page with results
    res.render("search", {
      user: req.session.user,
      keyword,
      youtubeResults,
      redditResults
    });

  } catch (error) {
    console.error("Search error:", error.response?.data || error.message);
    res.render("search", {
      user: req.session.user,
      keyword,
      youtubeResults: [],
      redditResults: [],
      error: "Failed to fetch results. Please try again."
    });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});


