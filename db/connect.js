const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌  MONGODB_URI is required in production. Set it in your environment variables.');
      process.exit(1);
    }
    console.warn('⚠️  MONGODB_URI not set in .env — database writes will fail.');
    console.warn('    Add your MongoDB Atlas URI to .env to enable persistence.\n');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅  MongoDB connected successfully\n');
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('✅  MongoDB reconnected');
  });
}

module.exports = { connectDB };
