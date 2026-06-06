const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Tên đăng nhập là bắt buộc'],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    password: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
      minlength: 6,
    },
    // ── Thông tin tác giả ──────────────────────────────────────────────────────
    displayName: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    avatar: {
      type: String,   // URL ảnh (Cloudinary hoặc link ngoài)
      default: '',
    },
    // Mạng xã hội (để trống nếu không dùng)
    social: {
      facebook: { type: String, default: '' },
      twitter:  { type: String, default: '' },
      github:   { type: String, default: '' },
      website:  { type: String, default: '' },
    },
    // Vai trò (chuẩn bị cho đa tác giả)
    role: {
      type: String,
      enum: ['admin', 'author'],
      default: 'admin',
    },
  },
  { timestamps: true }
);

// Mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Phương thức kiểm tra mật khẩu khi đăng nhập
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
