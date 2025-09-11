import { Router } from "express";
import User from "../models/User.model.js";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Registering a new user
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    // 2. Check if email already exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: "Email already in use" });
    }
    // No errors yet so safe to make a new user
    // 3. Hash the password user has entered
    const passwordHash = await User.hashPassword(password);

    // 4. Create user
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || "user"
    });

    // 5. Generate tokens
    const payload = { sub: user._id.toString(), role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // 6. Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // change to true in production (https)
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // 7. Send response back to user
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      accessToken
    });

  } catch (err) {
    next(err);
  }
});

// Logging in a user
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Check required fields
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // 2. Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 3. Compare entered password with stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 4. Generate tokens
    const payload = { sub: user._id.toString(), role: user.role, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // 5. Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // change to true in production (https)
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // 6. Send response
    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      accessToken
    });

  } catch (err) {
    next(err);
  }
});

//  Get current logged-in user profile
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    // req.user.sub = userId from JWT payload
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    const user = await User.findById(userId).select("-passwordHash -__v");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json( user );

  } catch (err) {
    next(err);
  }
});

// Refresh access token using refresh token
router.post("/refresh", async (req, res, next) => {
  try {
    // 1. Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "Unauthorized: No refresh token" });
    }

    // 2. Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // 3. Create new tokens
    const newPayload = { sub: payload.sub, role: payload.role, email: payload.email };
    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload); // (optional: rotate refresh token)

    // 4. Reset refresh token cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // change to true in production (https)
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // 5. Return new access token
    res.json({ accessToken: newAccessToken });

  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// Logout user (clear refresh token cookie)
router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  });
  res.json({ message: "Logged out successfully" });
});

export default router;
