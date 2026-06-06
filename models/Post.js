const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề không được để trống'],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, 'Nội dung bài viết không được để trống'],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',  // bài cũ không có field này sẽ tự coi là published
    },
    category: {
      type: String,
      required: [true, 'Vui lòng chọn danh mục'],
      trim: true,
    },
    author: {
      type: String,
      default: 'Admin',
      trim: true,
    },
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    thumbnail: {
      type: String,
      default: null,
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Hook tạo excerpt tự động (nếu có)
postSchema.pre('save', async function () {
  if (this.isModified('content') && !this.excerpt) {
    const plainText = this.content.replace(/<[^>]+>/g, '');
    this.excerpt = plainText.substring(0, 200).trim() + '...';
  }
  // Lưu ý không gọi next() trong async function
});

// Virtual: thời gian đọc (phút)
postSchema.virtual('readingTime').get(function () {
  const text = this.content || '';
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  return Math.ceil(wordCount / 200);
});

module.exports = mongoose.model('Post', postSchema);