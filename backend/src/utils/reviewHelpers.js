import mongoose from "mongoose";
import Review from "../models/Review.model.js";
import Service from "../models/Service.model.js";

export async function refreshServiceRating(serviceId) {
  const svcId = typeof serviceId === "string" ? new mongoose.Types.ObjectId(serviceId) : serviceId;

  // Aggregate reviews for the service
  const agg = await Review.aggregate([
    { $match: { serviceId: svcId } },
    { $group: { _id: "$serviceId", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]);

  if (agg.length === 0) {
    // no reviews
    await Service.findByIdAndUpdate(serviceId, { ratingAverage: 0, ratingCount: 0 });
  } else {
    const { avgRating, count } = agg[0];
    await Service.findByIdAndUpdate(serviceId, { ratingAverage: avgRating, ratingCount: count });
  }
}
