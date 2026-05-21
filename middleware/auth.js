// middleware/auth.js
module.exports = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next(); // Đã đăng nhập, cho phép tiếp tục
  }
  res.redirect('/admin'); // Chưa đăng nhập, chuyển về trang login
};