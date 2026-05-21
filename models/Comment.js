const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',       // tham chiếu đến model Post
      required: true,
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
  { timestamps: false } // chúng ta tự quản lý createdAt ở trên, không cần updatedAt
);

module.exports = mongoose.model('Comment', commentSchema);