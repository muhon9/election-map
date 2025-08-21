import mongoose from "mongoose";

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export default async function dbConnect() {

  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
