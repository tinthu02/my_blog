const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');

const ITEMS_PER_PAGE = 6;

// ── Rate limiter: tối đa 5 comment / 1 IP / 60 phút ──────────────────────────
const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  handler: (req, res) => {
    if (req.headers['content-type']?.includes('application/json')) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã bình luận quá nhiều. Vui lòng thử lại sau 1 giờ.',
      });
    }
    res.status(429).send('Bạn đã bình luận quá nhiều. Vui lòng thử lại sau 1 giờ.');
  },
});

async function renderHomePage(req, res, page = 1) {
  try {
    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / ITEMS_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
    const posts = await Post.find({ status: { $ne: 'draft' } })
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
      .lean();
    const categories = await Post.distinct('category');
    // Lấy tác giả đầu tiên để hiển thị ở footer
    const siteAuthor = await User.findOne().lean();
    res.render('home', {
      posts,
      currentPage,
      totalPages,
      category: undefined,
      categories,
      siteAuthor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
}

// GET /reading-list — Trang danh sách đọc sau
router.get('/reading-list', (req, res) => {
  res.render('reading-list');
});

// GET / — Trang chủ (trang 1)
router.get('/', (req, res) => renderHomePage(req, res, 1));

// GET /page/:page — Các trang sau
router.get('/page/:page', (req, res) => {
  const page = parseInt(req.params.page) || 1;
  renderHomePage(req, res, page);
});

// GET /post/:id — Xem chi tiết bài viết
router.get('/post/:id', async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate(
    { _id: req.params.id },
    { $inc: { views: 1 } },
    { returnDocument: 'after' }   // ✅ Cách dùng mới từ Mongoose 7+
    );

    if (!post || post.status === 'draft') return res.status(404).send('Không tìm thấy bài viết');

    //const safeContent = post.content.replace(/<%/g, '<%%');
    const safeContent = post.content
      .replace(/<%/g, '<%%')
      .replace(/<\/body>/gi, '')
      .replace(/<\/html>/gi, '');

    const allComments = await Comment.find({ postId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();

    const commentMap = {};
    allComments.forEach(c => { commentMap[c._id.toString()] = { ...c, replies: [] }; });

    const rootComments = [];
    allComments.forEach(c => {
      if (c.parentId) {
        const parent = commentMap[c.parentId.toString()];
        if (parent) parent.replies.push(commentMap[c._id.toString()]);
      } else {
        rootComments.push(commentMap[c._id.toString()]);
      }
    });

    rootComments.reverse();

    const relatedPosts = await Post.find({
      _id: { $ne: post._id },
      category: post.category
    }).sort({ createdAt: -1 }).limit(4).lean();

    // Tìm thông tin tác giả (nếu có user khớp username)
    const authorUser = await User.findOne({ username: new RegExp(`^${post.author}$`, 'i') }).lean();

    res.render('post', {
      post: { ...post.toObject(), content: safeContent },
      comments: rootComments,
      totalComments: allComments.length,
      relatedPosts,
      authorUser: authorUser || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// ── TRANG TÁC GIẢ ─────────────────────────────────────────────────────────────
// GET /author/:username — Trang profile tác giả
router.get('/author/:username', async (req, res) => {
  try {
    const author = await User.findOne({ username: new RegExp(`^${req.params.username}$`, 'i') }).lean();
    if (!author) return res.status(404).send('Không tìm thấy tác giả');

    const page = parseInt(req.query.page) || 1;
    const AUTHOR_PER_PAGE = 6;

    const filter = { author: author.username, status: { $ne: 'draft' } };

    const totalPosts = await Post.countDocuments(filter);
    const totalPages = Math.ceil(totalPosts / AUTHOR_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * AUTHOR_PER_PAGE)
      .limit(AUTHOR_PER_PAGE)
      .lean();

    // Thống kê tác giả
    const totalViews = await Post.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$views' } } }
    ]);
    const totalLikes = await Post.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$likes' } } }
    ]);
    const categories = await Post.distinct('category', filter);

    res.render('author', {
      author,
      posts,
      currentPage,
      totalPages,
      totalPosts,
      totalViews: totalViews[0]?.total || 0,
      totalLikes: totalLikes[0]?.total || 0,
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// POST /post/:id/like — Upvote bài viết
router.post('/post/:id/like', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.json({ likes: post.likes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// POST /post/:id/comment — Thêm bình luận gốc
router.post('/post/:id/comment', commentLimiter, async (req, res) => {
  try {
    const { author, content } = req.body;
    if (!author || !content) {
      return res.send('Vui lòng nhập tên và nội dung bình luận');
    }
    await Comment.create({ postId: req.params.id, author, content });
    res.redirect(`/post/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// ─── API JSON ───────────────────────────────────────────────────────────────

// POST /api/posts/:id/comments — Thêm bình luận gốc (AJAX)
router.post('/api/posts/:id/comments', commentLimiter, async (req, res) => {
  try {
    const { author, content } = req.body;
    if (!author || !content) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên và nội dung' });
    }
    const comment = await Comment.create({
      postId: req.params.id,
      author: author.trim(),
      content: content.trim(),
      parentId: null,
    });
    res.json({ success: true, comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// POST /api/posts/:postId/comments/:commentId/reply — Trả lời bình luận (AJAX)
router.post('/api/posts/:postId/comments/:commentId/reply', commentLimiter, async (req, res) => {
  try {
    const { author, content } = req.body;
    if (!author || !content) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên và nội dung' });
    }

    const parentComment = await Comment.findOne({
      _id: req.params.commentId,
      postId: req.params.postId,
    });
    if (!parentComment) {
      return res.status(404).json({ success: false, message: 'Bình luận không tồn tại' });
    }

    const rootParentId = parentComment.parentId || parentComment._id;

    const reply = await Comment.create({
      postId: req.params.postId,
      parentId: rootParentId,
      author: author.trim(),
      content: content.trim(),
    });

    res.json({ success: true, comment: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// GET /category/:name — Lọc bài theo danh mục
router.get('/category/:name', async (req, res) => {
  try {
    const posts = await Post.find({ category: req.params.name }).sort({ createdAt: -1 });
    res.render('home', { posts, category: req.params.name });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// GET /search — Trang kết quả tìm kiếm nâng cao
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const category = req.query.category || '';
    const filter = {};

    if (query.trim()) {
      const regex = new RegExp(query.trim(), 'i');
      filter.$or = [{ title: regex }, { content: regex }];
    }
    if (category.trim()) {
      filter.category = category.trim();
    }
    if (!query.trim() && !category.trim()) {
      return res.redirect('/');
    }

    const posts = await Post.find(filter).sort({ createdAt: -1 }).lean();
    const categories = await Post.distinct('category');
    res.render('search', { posts, query, category, categories });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

module.exports = router;
