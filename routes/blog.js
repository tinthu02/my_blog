const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Comment = require('../models/Comment');

const ITEMS_PER_PAGE = 6;

async function renderHomePage(req, res, page = 1) {
  try {
    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / ITEMS_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
      .lean();
    res.render('home', {
      posts,
      currentPage,
      totalPages,
      category: undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
}

// GET / — Trang chủ (trang 1)
router.get('/', (req, res) => renderHomePage(req, res, 1));

// GET /page/:page — Các trang sau
router.get('/page/:page', (req, res) => {
  const page = parseInt(req.params.page) || 1;
  renderHomePage(req, res, page);
});

// GET /post/:id — Xem chi tiết bài viết, bình luận, bài liên quan, tăng view, 
// escape toàn bộ ký tự <% thành <%% để EJS không hiểu nhầm thành thẻ của nó
router.get('/post/:id', async (req, res) => {
  // Tăng lượt xem
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id }, // tìm và tăng view
      { $inc: { views: 1 } }, // tăng view
      { new: true }
    );

    if (!post) return res.status(404).send('Không tìm thấy bài viết'); 

    // Escape các ký tự <% để an toàn với EJS, nhưng giữ nguyên HTML
    const safeContent = post.content.replace(/<%/g, '<%%');
    
    const comments = await Comment.find({ postId: req.params.id }).sort({ createdAt: -1 });
    const relatedPosts = await Post.find({
      _id: { $ne: post._id },
      category: post.category
    }).sort({ createdAt: -1 }).limit(4).lean(); // lấy bài liên quan cùng category, trừ bài hiện tại

    res.render('post', {
      post: { ...post.toObject(), content: safeContent },
      comments,
      relatedPosts
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// POST /post/:id/comment — Lưu bình luận
router.post('/post/:id/comment', async (req, res) => {
  try {
    const { author, content } = req.body;
    if (!author || !content) {
      return res.send('Vui lòng nhập tên và nội dung bình luận');
    }
    await Comment.create({
      postId: req.params.id,
      author,
      content
    });
    res.redirect(`/post/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// GET /category/:name — Lọc bài theo danh mục
router.get('/category/:name', async (req, res) => {
  try {
    const posts = await Post.find({ category: req.params.name }).sort({ createdAt: -1 });
    res.render('home', { posts, category: req.params.name }); // tận dụng home.ejs
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

// GET /search — Trang kết quả tìm kiếm (fallback)
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || !query.trim()) {
      return res.redirect('/');
    }
    const regex = new RegExp(query.trim(), 'i');
    const posts = await Post.find({
      $or: [{ title: regex }, { content: regex }]
    }).sort({ createdAt: -1 });

    res.render('search', { posts, query });
  } catch (err) {
    console.error(err);
    res.status(500).send('Lỗi server');
  }
});

module.exports = router;