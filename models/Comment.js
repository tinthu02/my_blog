const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    // null = bình luận gốc, có giá trị = reply của bình luận đó
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    author: {
      type: String,
      required: [true, 'Vui lòng nhập tên của bạn'],
      trim: true,
      maxlength: 50,
    },
    content: {
      type: String,
      required: [true, 'Nội dung bình luận không được để trống'],
      maxlength: 1000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model('Comment', commentSchema);
