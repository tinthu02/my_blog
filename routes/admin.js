const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'img', 'u', 'pre', 'code', 'strike']),
  allowedAttributes: {
    '*': ['class', 'style', 'id'],
    'a': ['href', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https'],
};

// ========== PHẦN ĐĂNG NHẬP ==========

// GET /admin — Trang đăng nhập
router.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/admin/posts'); // đã đăng nhập thì vào dashboard
  }
  res.render('admin/login');
});

// POST /admin/login — Xử lý đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.send('Sai tên đăng nhập hoặc mật khẩu');
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.send('Sai tên đăng nhập hoặc mật khẩu');
    }
    req.session.userId = user._id;
    res.redirect('/admin/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// ========== QUẢN LÝ BÀI VIẾT ==========

// Dashboard: GET /admin/posts
router.get('/posts', auth, async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.render('admin/dashboard', { posts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// Form tạo mới: GET /admin/posts/new
router.get('/posts/new', auth, (req, res) => {
  res.render('admin/new');
});

// Lưu bài mới: POST /admin/posts
router.post('/posts', auth, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title || !content || !category) {
      return res.send('Vui lòng điền đầy đủ thông tin');
    }
    const cleanContent = sanitizeHtml(content, sanitizeOptions);
    await Post.create({ title, content: cleanContent, category, author: 'Admin' });
    res.redirect('/admin/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// Form sửa: GET /admin/posts/:id/edit
router.get('/posts/:id/edit', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Không tìm thấy bài viết');
    res.render('admin/edit', { post });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// Cập nhật: PUT /admin/posts/:id
router.put('/posts/:id', auth, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const cleanContent = sanitizeHtml(content, sanitizeOptions);
    await Post.findByIdAndUpdate(req.params.id, { title, content: cleanContent, category });
    res.redirect('/admin/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// Xóa: DELETE /admin/posts/:id
router.delete('/posts/:id', auth, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/admin/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

module.exports = router;