import { verifyAccessToken } from "../utils/jwt.js";

//  Protect routes: checks if valid JWT is provided
export const requireAuth = (req, res, next) => {
  try {
    // Accept token from Authorization header OR cookie
    const header = req.headers["authorization"];
    const token = header && header.startsWith("Bearer ")
      ? header.slice(7)
      : req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    // Verify token
    const payload = verifyAccessToken(token);

    // Attach essential info to req.user
    // Make sure your JWT payload includes these when issuing tokens
    req.user = {
      id: payload.sub,       // userId from JWT "sub" claim
      role: payload.role,    // role from JWT
      email: payload.email,  // optional but handy
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

// Restrict routes to specific roles
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    next();
  };
};
