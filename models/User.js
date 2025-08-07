const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true }, // e.g., USR12345
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImage: {
  type: String,
  default: ''
},
firstLogin: {
  type: Boolean,
  default: true,
},


  resetToken: String,              // ✅ add this
  resetTokenExpiry: Date           // ✅ and this
});

module.exports = mongoose.model('User', userSchema);
