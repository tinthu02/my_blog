// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const path = require('path');

// Import route
const blogRoutes = require('./routes/blog');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
app.set('trust proxy', 1); // Đọc IP thật qua reverse proxy (Render, Heroku, nginx...)

// 1. Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Kết nối MongoDB Atlas thành công!'))
  .catch(err => {
    console.error('❌ Lỗi kết nối MongoDB:', err.message);
    process.exit(1);
  });

// 2. Body Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const methodOverride = require('method-override');
app.use(methodOverride('_method')); // Cho phép đọc ?_method=PUT hoặc body._method

// 3. Static files
app.use(express.static(path.join(__dirname, 'public')));

// 4. Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// 5. View Engine
app.set('view engine', 'ejs');
app.set('view cache', false); // Tắt cache view của Express (đảm bảo luôn đọc file mới)
app.set('views', path.join(__dirname, 'views'));

// 6. Routes
app.use('/', blogRoutes);           // Các route công khai
app.use('/admin', adminRoutes);     // Các route quản trị
app.use('/api', apiRoutes);       // Các route API

// 7. 404
app.use((req, res) => {
  res.status(404).send('Trang không tồn tại');
});

// 8. Lỗi chung
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Đã có lỗi xảy ra!');
});

// 9. Khởi động
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});