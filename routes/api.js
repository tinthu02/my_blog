const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Comment = require('../models/Comment'); // giữ lại nếu cần
const Subscriber = require('../models/Subscriber');

// POST /api/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email' });
    }
    
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
    }

    const existing = await Subscriber.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email này đã được đăng ký' });
    }

    await Subscriber.create({ email: email.trim().toLowerCase() });
    res.status(201).json({ success: true, message: 'Đăng ký nhận tin thành công!' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email này đã được đăng ký' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server, vui lòng thử lại' });
  }
});

// GET /api/search?q=từ_khoá thêm reading time  
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || !query.trim()) {
      return res.json({ success: true, results: [] });
    }
    const regex = new RegExp(query.trim(), 'i');
    const posts = await Post.find({
      $or: [{ title: regex }, { content: regex }]
    })
      .select('title excerpt category createdAt content')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    const results = posts.map(post => ({
      ...post,
      readingTime: Math.ceil(
        (post.content || '').split(/\s+/).filter(w => w.length > 0).length / 200
      )
    }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/posts/:id/comments (giữ nguyên route cũ)
router.post('/posts/:id/comments', async (req, res) => {
  try {
    const { author, content } = req.body;
    
    // Validation
    if (!author || !author.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng nhập tên của bạn' 
      });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng nhập nội dung bình luận' 
      });
    }

    const comment = await Comment.create({
      postId: req.params.id,
      author: author.trim(),
      content: content.trim()
    });

    // Trả về bình luận vừa tạo (kèm ngày để hiển thị)
    res.status(201).json({
      success: true,
      comment: {
        _id: comment._id,
        author: comment.author,
        content: comment.content,
        createdAt: comment.createdAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server, vui lòng thử lại' 
    });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments();

    // Thêm readingTime cho mỗi bài
    const postsWithReadingTime = posts.map(post => ({
      ...post,
      readingTime: Math.ceil(
        (post.content || '').split(/\s+/).filter(w => w.length > 0).length / 200
      )
    }));

    res.json({
      success: true,
      posts: postsWithReadingTime,
      hasMore: skip + posts.length < total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;