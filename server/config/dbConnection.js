import mongoose from 'mongoose';

const DEFAULT_DATABASE = 'lexipath';

export function mongoUriWithDefaultDatabase(uri) {
  if (!uri) return uri;
  const parsed = new URL(uri);
  if (parsed.pathname === '' || parsed.pathname === '/') {
    parsed.pathname = `/${DEFAULT_DATABASE}`;
  }
  return parsed.toString();
}

const connectDB = async () => {
  try {
    const connect = await mongoose.connect(mongoUriWithDefaultDatabase(process.env.MONGODB_URI));
    console.log(`MongoDB connected: ${connect.connection.host} ${connect.connection.name}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB;
