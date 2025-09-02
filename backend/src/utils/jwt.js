import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// Read secrets + expiry times from .env
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "supersecretaccess";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "supersecretrefresh";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";  // time to live
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

// To Generate Access Token
export const signAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
};

// To Generate Refresh Token
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
};

// To Verify Access Token
export const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

// To Verify Refresh Token
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};
