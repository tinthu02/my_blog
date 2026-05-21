// seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Đã kết nối MongoDB');
    
    // Tạo admin nếu chưa tồn tại
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('Tài khoản admin đã tồn tại');
      process.exit(0);
    }

    await User.create({
      username: 'admin',
      password: 'admin123' // Bạn nên đổi mật khẩu mạnh hơn sau khi tạo
    });
    console.log('Đã tạo tài khoản admin: username=admin, password=admin123');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });