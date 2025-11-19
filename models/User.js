import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true, minlength: 3, maxlength: 24 },
    email:    { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true }, // bcrypt hash
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);