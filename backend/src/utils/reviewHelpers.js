import mongoose from "mongoose";
import Review from "../models/Review.model.js";
import Service from "../models/Service.model.js";

export async function refreshServiceRating(serviceId) {
  try {
    const svcId = typeof serviceId === "string" ? new mongoose.Types.ObjectId(serviceId) : serviceId;
    console.log(`[reviews] refreshServiceRating: computing for ${svcId.toString()}`);

    const agg = await Review.aggregate([
      { $match: { serviceId: svcId } },
      { $group: { _id: "$serviceId", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);

    if (agg.length === 0) {
      console.log(`[reviews] no reviews found for ${svcId.toString()}, resetting service ratings`);
      await Service.findByIdAndUpdate(serviceId, { ratingAverage: 0, ratingCount: 0 });
    } else {
      const { avgRating, count } = agg[0];
      const rounded = Math.round((avgRating + Number.EPSILON) * 100) / 100;
      console.log(`[reviews] agg for ${svcId.toString()} -> avg:${avgRating}, rounded:${rounded}, count:${count}`);
      await Service.findByIdAndUpdate(serviceId, { ratingAverage: rounded, ratingCount: count });
    }
  } catch (err) {
    console.error("[reviews] refreshServiceRating failed:", err);
    throw err;
  }
}
