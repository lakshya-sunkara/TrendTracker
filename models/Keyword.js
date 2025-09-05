const mongoose = require("mongoose");

const trendPointSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now, index: true },
  videoCount: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },
  totalLikes: { type: Number, default: 0 },
  totalComments: { type: Number, default: 0 },
});

const keywordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
  keyword: { type: String, required: true },
  platform: { type: String, enum: ["youtube"], default: "youtube" },
  trendData: { type: [trendPointSchema], default: [] },
}, { timestamps: true });

keywordSchema.index({ userId: 1, keyword: 1 }, { unique: true }); // prevent duplicates per user

module.exports = mongoose.model("Keyword", keywordSchema);
