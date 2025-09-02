import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Define schema
const UserSchema = new mongoose.Schema(
  {
    // Full name of the user
    name: { type: String, required: true, trim: true },

    // Unique email used for login
    email: { type: String, required: true, unique: true, lowercase: true },

    // Phone number (optional for now, but useful later for OTP/notifications)
    phone: { type: String },

    // Store hashed password (never plain text!)
    passwordHash: { type: String, required: true },

    // Role defines access level
    role: {
      type: String,
      enum: ["user", "provider", "admin"], // allowed values
      default: "user"
    },

    // For providers → admin can set this true once verified
    isVerified: { type: Boolean, default: false }
  },
  {
    timestamps: true // adds createdAt and updatedAt automatically
  }
);

// 🔒 Instance method → compare plain password with stored hash
UserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// 🔒 Static method → hash a plain password before saving
UserSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10); // cost factor = 10
  return bcrypt.hash(plainPassword, salt);
};

// Export model
export default mongoose.model("User", UserSchema);
