import mongoose from "mongoose";

/**
 * Service model
 * - images: stored as objects { url, public_id } to support Cloudinary
 * - tags: string array, normalized to lowercase + unique on save; server enforces maxTags
 * - text index for quick search across title/description/category/tags
 */

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String },
    public_id: { type: String, default: null },
  },
  { _id: false }
);

const ServiceSchema = new mongoose.Schema(
  {
    // Name of service (e.g. Plumbing, Tutoring, etc.)
    title: { type: String, required: true, trim: true },

    // Detailed description
    description: { type: String, trim: true },

    // Category (helps with search/filter later)
    category: { type: String, trim: true },

    // Price per unit/hour — must be >= 0
    price: { type: Number, required: true, min: 0 },

    // Reference to provider (User who created this service)
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Images for the service (supports Cloudinary public_id + url)
    images: { type: [ImageSchema], default: [] },

    // Availability toggle
    isAvailable: { type: Boolean, default: true },

    // Tags: small list of normalized strings (we enforce normalization in pre-save)
    tags: { type: [String], default: [] },

    // To display service ratings
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

/**
 * Normalize tags before saving:
 *  - ensure lowercase + trimmed
 *  - remove duplicates
 *  - limit to a small number (5) for UX & storage sanity
 */
const MAX_TAGS = 5;

ServiceSchema.pre("save", function (next) {
  try {
    if (Array.isArray(this.tags)) {
      const normalized = this.tags
        .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
        .filter(Boolean);

      // unique preserve order
      const seen = new Set();
      const unique = [];
      for (const t of normalized) {
        if (!seen.has(t)) {
          seen.add(t);
          unique.push(t);
        }
        if (unique.length >= MAX_TAGS) break;
      }

      this.tags = unique;
    } else {
      this.tags = [];
    }
  } catch (err) {
    // swallow normalization errors and continue — validation will catch issues
    console.warn("ServiceSchema pre-save tag normalization failed:", err);
  }
  next();
});

/**
 * Indexes
 * - text index across fields for free-text search
 * - index on tags for tag-based filtering
 * - keep other useful indexes commented for future use
 */
ServiceSchema.index({ title: "text", description: "text", tags: "text", category: "text" });
ServiceSchema.index({ tags: 1 });
// ServiceSchema.index({ providerId: 1 });
// ServiceSchema.index({ isAvailable: 1 });

export default mongoose.model("Service", ServiceSchema);
