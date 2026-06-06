const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const sanitizeHtml = require('sanitize-html');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình Multer — upload thẳng lên Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'my-blog/thumbnails',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 450, crop: 'fill' }],
  },
});
const upload = multer({ storage });

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'img', 'u', 'pre', 'code', 'strike']),
  allowedAttributes: {
    '*': ['class', 'style', 'id'],
    'a': ['href', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https'],
};

// ========== ĐĂNG NHẬP ==========

router.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/admin/posts');
  res.render('admin/login');
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.send('Sai tên đăng nhập hoặc mật khẩu');
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.send('Sai tên đăng nhập hoặc mật khẩu');
    req.session.userId = user._id;
    res.redirect('/admin/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// ========== DASHBOARD (bài viết + thống kê + bình luận) ==========

router.get('/posts', auth, async (req, res) => {
  try {
    const tab = req.query.tab || 'posts'; // tab mặc định

    // Lấy tất cả bài (cả draft lẫn published)
    const posts = await Post.find().sort({ createdAt: -1 }).lean();

    // ── Thống kê ──────────────────────────────────────────────────
    const totalPosts     = await Post.countDocuments({ status: { $ne: 'draft' } });
    const totalDrafts    = await Post.countDocuments({ status: 'draft' });
    const totalComments  = await Comment.countDocuments();
    const totalViews     = posts.reduce((sum, p) => sum + (p.views || 0), 0);

    // Top 5 bài nhiều view nhất
    const topByViews = await Post.find({ status: { $ne: 'draft' } })
      .sort({ views: -1 })
      .limit(5)
      .select('title views category createdAt')
      .lean();

    // Top 5 bài nhiều bình luận nhất (dùng aggregation)
    const topByComments = await Comment.aggregate([
      { $group: { _id: '$postId', commentCount: { $sum: 1 } } },
      { $sort: { commentCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: '_id',
          as: 'post',
        },
      },
      { $unwind: '$post' },
      {
        $project: {
          commentCount: 1,
          title: '$post.title',
          postId: '$post._id',
        },
      },
    ]);

    // ── Bình luận gần đây (để quản lý) ───────────────────────────
    const recentComments = await Comment.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Gắn tên bài viết vào từng comment
    const postIds = [...new Set(recentComments.map(c => c.postId.toString()))];
    const postMap = {};
    const relatedPosts = await Post.find({ _id: { $in: postIds } }).select('title').lean();
    relatedPosts.forEach(p => { postMap[p._id.toString()] = p.title; });
    recentComments.forEach(c => { c.postTitle = postMap[c.postId.toString()] || '(Bài đã xóa)'; });

    res.render('admin/dashboard', {
      posts,
      tab,
      stats: { totalPosts, totalDrafts, totalComments, totalViews },
      topByViews,
      topByComments,
      recentComments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// ========== XÓA BÌNH LUẬN ==========

router.delete('/comments/:id', auth, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.redirect('/admin/posts?tab=comments');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// ========== QUẢN LÝ BÀI VIẾT ==========

router.get('/posts/new', auth, async (req, res) => {
  try {
    const categories = await Post.distinct('category');
    res.render('admin/new', { categories });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// Lưu bài mới (draft hoặc published tùy nút submit)
router.post('/posts', auth, (req, res, next) => {
  upload.single('thumbnail')(req, res, (err) => {
    if (err) {
      console.error('LỖI UPLOAD:', err);
      return res.status(500).send('Lỗi upload: ' + err.message);
    }
    next();
  });
}, async (req, res) => {
  try {
    const { title, content, category, status } = req.body;
    if (!title || !content || !category) {
      return res.send('Vui lòng điền đầy đủ thông tin');
    }
    const cleanContent = sanitizeHtml(content, sanitizeOptions);
    const thumbnail = req.file ? req.file.path : (req.body.thumbnailUrl || null);
    // status từ form: 'draft' hoặc 'published'
    await Post.create({
      title,
      content: cleanContent,
      category,
      author: 'Admin',
      thumbnail,
      status: status === 'draft' ? 'draft' : 'published',
    });
    res.redirect('/admin/posts');
  } catch (err) {
    console.error('LỖI TẠO BÀI:', err);
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

router.get('/posts/:id/edit', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Không tìm thấy bài viết');
    const categories = await Post.distinct('category');
    res.render('admin/edit', { post, categories });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

router.put('/posts/:id', auth, upload.single('thumbnail'), async (req, res) => {
  try {
    const { title, content, category, status } = req.body;
    const cleanContent = sanitizeHtml(content, sanitizeOptions);
    const updateData = {
      title,
      content: cleanContent,
      category,
      status: status === 'draft' ? 'draft' : 'published',
    };
    if (req.file) {
      updateData.thumbnail = req.file.path;
    } else if (req.body.thumbnailUrl) {
      updateData.thumbnail = req.body.thumbnailUrl;
    }
    await Post.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/admin/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

router.delete('/posts/:id', auth, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/admin/posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// PATCH nhanh: đổi trạng thái draft ↔ published ngay từ dashboard
router.patch('/posts/:id/status', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Không tìm thấy bài viết');
    post.status = post.status === 'draft' ? 'published' : 'draft';
    await post.save();
    res.redirect('/admin/posts?tab=posts');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

// GET /admin/profile — Trang chỉnh sửa profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).lean();
    if (!user) return res.redirect('/admin/login');
    res.render('admin/profile', { user, success: req.query.success });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});
 
// POST /admin/profile — Lưu profile
router.post('/profile', auth, async (req, res) => {
  try {
    const { displayName, bio, avatar, facebook, twitter, github, website } = req.body;
 
    await User.findByIdAndUpdate(req.session.userId, {
      displayName: displayName?.trim() || '',
      bio: bio?.trim() || '',
      avatar: avatar?.trim() || '',
      social: {
        facebook: facebook?.trim() || '',
        twitter:  twitter?.trim()  || '',
        github:   github?.trim()   || '',
        website:  website?.trim()  || '',
      },
    });
 
    res.redirect('/admin/profile?success=1');
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

module.exports = router;